/**
 * useMongoAuthState
 * Drop-in replacement for Baileys' useMultiFileAuthState.
 * Stores all auth credentials and signal keys in MongoDB (WaAuthState model)
 * so the WhatsApp session survives Render restarts and redeploys with no disk needed.
 */

import { prisma } from "../config/database.js";

async function readFromMongo(key: string): Promise<any> {
  try {
    const doc = await prisma.waAuthState.findUnique({ where: { key } });
    if (!doc?.value) return null;
    const baileys = await import("@whiskeysockets/baileys") as any;
    return JSON.parse(doc.value, baileys.BufferJSON.reviver);
  } catch {
    return null;
  }
}

async function writeToMongo(key: string, value: any): Promise<void> {
  try {
    const baileys = await import("@whiskeysockets/baileys") as any;
    const str = JSON.stringify(value, baileys.BufferJSON.replacer);
    await prisma.waAuthState.upsert({
      where: { key },
      update: { value: str },
      create: { key, value: str },
    });
  } catch (err) {
    console.error("📱 waAuthStore writeToMongo error:", err);
  }
}

async function removeFromMongo(key: string): Promise<void> {
  try {
    await prisma.waAuthState.delete({ where: { key } });
  } catch {
    // ignore — key may not exist
  }
}

export async function clearMongoAuthState(): Promise<void> {
  await prisma.waAuthState.deleteMany({});
}

export async function useMongoAuthState() {
  const baileys = await import("@whiskeysockets/baileys") as any;
  const { initAuthCreds, proto } = baileys;

  // Load or initialise credentials
  let creds = await readFromMongo("creds");
  if (!creds) creds = initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, any> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readFromMongo(`${type}-${id}`);
              if (value != null) {
                // Baileys expects app-state-sync-key values as protobuf objects
                if (type === "app-state-sync-key" && proto?.Message?.AppStateSyncKeyData) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                data[id] = value;
              }
            })
          );
          return data;
        },

        set: async (data: Record<string, Record<string, any>>) => {
          await Promise.all(
            Object.entries(data).flatMap(([type, ids]) =>
              Object.entries(ids).map(([id, value]) => {
                const key = `${type}-${id}`;
                return value != null ? writeToMongo(key, value) : removeFromMongo(key);
              })
            )
          );
        },
      },
    },

    saveCreds: async () => {
      await writeToMongo("creds", creds);
    },
  };
}
