import path from "path";
import fs from "fs";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { emitToTicketRoom, emitToAll, emitToChatSession } from "./socket.service.js";

// ── State ──────────────────────────────────────────────────────────────────────

let sock: any = null;
let latestQR: string | null = null;
let isConnected = false;

// Dedup: skip messages we've already processed (handles Baileys double-fire)
const processedMsgIds = new Set<string>();

export function getWhatsAppStatus(): { connected: boolean; hasQR: boolean; qr: string | null } {
  return { connected: isConnected, hasQR: !!latestQR, qr: latestQR };
}

// ── Outbound ───────────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(jid: string, text: string): Promise<void> {
  if (!sock || !isConnected) {
    console.warn("📱 WhatsApp not connected — cannot send message to", jid);
    return;
  }
  try {
    await sock.sendMessage(jid, { text });
  } catch (err) {
    console.error("📱 Failed to send WA message:", err);
  }
}

// ── Inbound processing (Option 1 — direct, no queue) ──────────────────────────

async function processInboundMessage(msg: any): Promise<void> {
  const jid: string = msg.key.remoteJid;
  const waId: string = msg.key.id;

  // Extract text from common message types
  const text: string =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "[media message]";

  // ── Admin reply to a chat widget session ──────────────────────────────────
  // Format: "[SHORTTOKEN] response text" sent from any number in ADMIN_WA_JID
  const adminJids = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
  const inboundPhone = jid.split("@")[0].split(":")[0];
  const adminPhoneList = adminJids.map((j) => j.split("@")[0]);
  if (adminJids.length > 0 && adminPhoneList.includes(inboundPhone)) {
    const match = text.match(/^\[([A-Za-z0-9]{8})\]\s*([\s\S]+)/);
    if (match) {
      const shortToken = match[1].toLowerCase();
      const replyText = match[2].trim();
      const session = await prisma.chatSession.findFirst({
        where: { sessionToken: { startsWith: shortToken } },
      });
      if (session) {
        const adminMsg = await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            senderType: "admin",
            content: replyText,
          },
        });
        emitToChatSession(session.sessionToken, "chat_reply", {
          id: adminMsg.id,
          senderType: "admin",
          content: replyText,
          createdAt: adminMsg.createdAt,
        });
        console.log(`💬 Admin reply routed to chat session ${session.sessionToken.slice(0, 8)}…`);
        return; // don't process as a ticket message
      }
    }
    // Unrecognised message from admin — ignore silently
    return;
  }

  // Dedup — skip if we already processed this WA message ID
  const already = await prisma.ticketMessage.findFirst({
    where: { whatsappMsgId: waId },
  });
  if (already) return;

  // Human-readable phone from JID ("2348012345678@s.whatsapp.net" → "+2348012345678")
  const phone = "+" + jid.split("@")[0].split(":")[0];

  // Look for an open ticket that originated from this WA number
  let ticket = await prisma.supportTicket.findFirst({
    where: { whatsappJid: jid, status: { not: "closed" } },
    orderBy: { createdAt: "desc" },
  });

  if (!ticket) {
    // ── New contact: create a ticket ──────────────────────────────────────────
    ticket = await prisma.supportTicket.create({
      data: {
        subject: `WhatsApp: ${phone}`,
        category: "general",
        priority: "medium",
        whatsappJid: jid,
        whatsappPhone: phone,
        messages: {
          create: {
            senderType: "user",
            message: text,
            whatsappMsgId: waId,
          },
        },
      },
    });

    // Auto-reply so user knows it was received
    await sendWhatsAppMessage(
      jid,
      `Hi! Your message has been received.\nTicket Ref: #${ticket.id.slice(-6).toUpperCase()}\n\nOur support team will respond shortly.`
    );

    // Notify all admin dashboards of the new ticket in real-time
    emitToAll("support_new_ticket", {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      user: null,
      firstMessage: text,
      messageCount: 1,
      whatsappPhone: phone,
    });

    console.log(`📱 New WA ticket created: ${ticket.id} from ${phone}`);
  } else {
    // ── Existing ticket: append a reply ───────────────────────────────────────
    const newMsg = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: "user",
        message: text,
        whatsappMsgId: waId,
      },
    });

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });

    // Push new message to admin panel in real-time (uses your existing Socket.IO)
    emitToTicketRoom(ticket.id, "support_new_reply", {
      ticketId: ticket.id,
      reply: {
        id: newMsg.id,
        message: text,
        isStaff: false,
        authorName: phone,
        createdAt: newMsg.createdAt,
        attachments: [],
      },
    });

    console.log(`📱 WA reply added to ticket ${ticket.id} from ${phone}`);
  }
}

// ── Admin chat reply (from WhatsApp → chat widget session) ────────────────────

async function processAdminChatReply(shortToken: string, replyText: string): Promise<void> {
  const session = await prisma.chatSession.findFirst({
    where: { sessionToken: { startsWith: shortToken.toLowerCase() } },
  });
  if (!session) {
    console.warn(`💬 processAdminChatReply: no session found for token prefix "${shortToken}"`);
    return;
  }
  const adminMsg = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      senderType: "admin",
      content: replyText,
    },
  });
  emitToChatSession(session.sessionToken, "chat_reply", {
    id: adminMsg.id,
    senderType: "admin",
    content: replyText,
    createdAt: adminMsg.createdAt,
  });
  console.log(`💬 Admin reply routed to chat session ${session.sessionToken.slice(0, 8)}…`);
}

// ── Baileys bootstrap ──────────────────────────────────────────────────────────

export async function startWhatsApp(): Promise<void> {
  try {
    // Dynamic import handles ESM/CJS interop (Baileys is ESM-only)
    const baileys = await import("@whiskeysockets/baileys") as any;

    // makeWASocket is a named export in Baileys v6/v7 (not a default export)
    const makeWASocket = baileys.makeWASocket ?? baileys.default?.makeWASocket ?? baileys.default;
    const { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = baileys;

    if (typeof makeWASocket !== "function") {
      console.error("📱 Failed to load makeWASocket from Baileys. Exports:", Object.keys(baileys));
      return;
    }

    const authDir = path.join(process.cwd(), "wa-auth");
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Minimal noop logger — satisfies Baileys' pino interface without noise
    const noopLogger: any = {
      level: "silent",
      info:  () => {},
      warn:  () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
      child: () => noopLogger,
    };

    const { version } = await fetchLatestBaileysVersion();
    console.log("📱 Creating WA socket (WA version:", version, ")...");
    sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu("Chrome"),
      logger: noopLogger,
    });
    console.log("📱 WA socket created, registering event handlers...");

    // Persist auth credentials whenever they change
    sock.ev.on("creds.update", saveCreds);

    // Handle connection state changes
    sock.ev.on("connection.update", async (update: any) => {
      console.log("📱 connection.update fired:", JSON.stringify(update).slice(0, 200));
      const { connection, lastDisconnect, qr } = update ?? {};

      if (qr) {
        latestQR = qr;
        isConnected = false;
        // Print scannable QR directly to terminal
        import("qrcode-terminal").then((m) => {
          (m.default ?? m).generate(qr, { small: true });
        });
        console.log("📱 WhatsApp QR ready — scan above or GET /api/admin/whatsapp/qr-image");
      }

      if (connection === "open") {
        isConnected = true;
        latestQR = null;
        console.log("✓ WhatsApp connected");
      }

      if (connection === "close") {
        isConnected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

        // Non-recoverable codes — hardcoded because dynamic import may not
        // resolve DisconnectReason enum values correctly in CJS context
        // 401 = loggedOut, 403 = forbidden, 405 = multideviceMismatch, 500 = badSession
        const FATAL_CODES = new Set([401, 403, 405, 500]);
        const isFatal = FATAL_CODES.has(statusCode);

        console.log(`📱 WhatsApp disconnected (code ${statusCode}). Will reconnect: ${!isFatal}`);

        if (isFatal) {
          // Wipe the saved auth so next startWhatsApp() shows a clean QR
          const authDir = path.join(process.cwd(), "wa-auth");
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log("📱 Auth state cleared — restart the server to scan a new QR code");
          } catch {}
        } else {
          // Transient disconnect (network blip etc.) — back-off 5s and retry
          setTimeout(() => startWhatsApp(), 5000);
        }
      }
    });

    // Handle incoming messages
    sock.ev.on("messages.upsert", async ({ messages, type }: any) => {
      for (const msg of messages) {
        if (!msg.message) continue;                             // decryption failed or receipt
        if (msg.key.remoteJid?.endsWith("@g.us")) continue;    // ignore group messages

        // Dedup: Baileys fires messages.upsert twice (append + notify) for the same message
        const msgId = msg.key.id as string;
        if (msgId && processedMsgIds.has(msgId)) continue;
        if (msgId) {
          processedMsgIds.add(msgId);
          if (processedMsgIds.size > 500) {
            // Prevent unbounded growth — trim oldest entries
            const first = processedMsgIds.values().next().value!;
            processedMsgIds.delete(first);
          }
        }

        const rawText: string =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          "";

        // DEBUG — log every non-group message so we can trace reply routing
        console.log(`📱 [msg] type=${type} fromMe=${msg.key.fromMe} jid=${msg.key.remoteJid} text="${rawText.slice(0, 80)}"`);

        // ── Admin commands: !online / !offline ───────────────────────────────
        // No JID gate — @lid format makes JID matching unreliable.
        // These are safe toggle commands anyone on a private bot number can send.
        const adminJidsCmd = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
        const remotePhone = msg.key.remoteJid?.split("@")[0].split(":")[0] ?? "";
        const cmd = rawText.trim().toLowerCase();
        if (cmd === "!online" || cmd === "!offline") {
          const isOnline = cmd === "!online";
          try {
            const existing = await prisma.chatConfig.findFirst();
            existing
              ? await prisma.chatConfig.update({ where: { id: existing.id }, data: { isOnline } })
              : await prisma.chatConfig.create({ data: { isOnline } });
            // Broadcast to all widget clients
            const { getIO } = await import("./socket.service.js");
            const io = getIO();
            if (io) io.of("/chat").emit("chat_status", { isOnline });
            await sendWhatsAppMessage(
              msg.key.remoteJid ?? adminJidsCmd[0],
              `✅ Chat widget is now *${isOnline ? "ONLINE 🟢" : "OFFLINE 🔴"}*`
            );
            console.log(`📱 Admin command handled: ${cmd} → isOnline=${isOnline}`);
          } catch (err) {
            console.error("Admin command error:", err);
          }
          continue;
        }

        // ── Method 1: Swipe-to-reply (no JID check — token is the auth) ─────
        // Works regardless of @lid vs @s.whatsapp.net JID format
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedText: string =
          contextInfo?.quotedMessage?.conversation ||
          contextInfo?.quotedMessage?.extendedTextMessage?.text ||
          "";
        const quotedTokenMatch = quotedText.match(/\[([A-Za-z0-9]{8})\]/);

        if (quotedTokenMatch && rawText.trim()) {
          console.log(`💬 Quoted-reply detected (token=${quotedTokenMatch[1]}) jid=${msg.key.remoteJid}`);
          try {
            await processAdminChatReply(quotedTokenMatch[1], rawText.trim());
          } catch (err) {
            console.error("💬 processAdminChatReply error:", err);
          }
          continue;
        }

        // ── Method 2: Manual prefix [TOKEN8CH] reply text (admin JID only) ──
        const adminJids = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
        const isFromMe = !!msg.key.fromMe;
        // Compare by phone digits only to handle @lid vs @s.whatsapp.net
        const isAdminJid = adminJids.map((j) => j.split("@")[0]).includes(remotePhone);
        const isAdmin = isFromMe || isAdminJid;

        if (isAdmin) {
          const tokenMatch = rawText.match(/^\[([A-Za-z0-9]{8})\]\s*([\s\S]+)/);
          if (tokenMatch) {
            console.log(`💬 Prefixed admin reply detected (token=${tokenMatch[1]})`);
            try {
              await processAdminChatReply(tokenMatch[1], tokenMatch[2].trim());
            } catch (err) {
              console.error("💬 processAdminChatReply error:", err);
            }
            continue;
          }
        }

        // ── Regular inbound from a visitor/external number ──
        if (type !== "notify") continue;
        if (msg.key.fromMe) continue;

        try {
          await processInboundMessage(msg);
        } catch (err) {
          console.error("📱 processInboundMessage error:", err);
        }
      }
    });

  } catch (err: any) {
    console.error("📱 Failed to start WhatsApp:", err?.message ?? err);
  }
}
