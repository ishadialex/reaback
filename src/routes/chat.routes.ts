import { Router, Request, Response } from "express";
import { prisma } from "../config/database.js";
import { sendWhatsAppMessage } from "../services/whatsapp.service.js";
import { env } from "../config/env.js";
import { uploadChatImages } from "../middleware/upload.js";

const router = Router();

function getVisitorIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  return (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    ""
  );
}

// ── GET /api/chat/status ─────────────────────────────────────────────────────
// Public — widget calls this to check if chat is online before showing.
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const config = await prisma.chatConfig.findFirst();
    return res.json({ success: true, data: { isOnline: config?.isOnline ?? true } });
  } catch (err) {
    console.error("chat/status error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/chat/visit ─────────────────────────────────────────────────────
// Called once per new visitor on first page load. Sends a WA ping to admin.
// Body: { sessionToken, currentPage?, userAgent? }
router.post("/visit", async (req: Request, res: Response) => {
  const { sessionToken, currentPage, userAgent } = req.body as {
    sessionToken?: string;
    currentPage?: string;
    userAgent?: string;
  };

  if (!sessionToken || typeof sessionToken !== "string") {
    return res.json({ success: true }); // silent — never block the widget
  }

  const visitorIp = getVisitorIp(req);
  const page = currentPage || "/";
  const ua = userAgent || (req.headers["user-agent"] as string) || "";

  try {
    await prisma.chatSession.upsert({
      where: { sessionToken },
      update: { visitorIp, userAgent: ua, currentPage: page },
      create: { sessionToken, visitorName: "Visitor", currentPage: page, visitorIp, userAgent: ua },
    });

    const adminJids = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
    if (adminJids.length > 0) {
      const shortToken = sessionToken.slice(0, 8).toUpperCase();
      const waText = `👀 *New Visitor* [${shortToken}]\n📄 ${page}\n🌐 ${visitorIp || "unknown"}`;
      for (const jid of adminJids) {
        sendWhatsAppMessage(jid, waText).catch(() => {});
      }
    }
  } catch {
    // silent — never break the page load
  }

  return res.json({ success: true });
});

// ── POST /api/chat/start ────────────────────────────────────────────────────
// Body: { sessionToken, visitorName?, currentPage?, userAgent? }
router.post("/start", async (req: Request, res: Response) => {
  const { sessionToken, visitorName, currentPage, userAgent } = req.body as {
    sessionToken?: string;
    visitorName?: string;
    currentPage?: string;
    userAgent?: string;
  };

  if (!sessionToken || typeof sessionToken !== "string") {
    return res.status(400).json({ success: false, message: "sessionToken required" });
  }

  const visitorIp = getVisitorIp(req);
  const ua = userAgent || (req.headers["user-agent"] as string) || "";

  try {
    const session = await prisma.chatSession.upsert({
      where: { sessionToken },
      update: {
        visitorIp,
        userAgent: ua,
        ...(visitorName ? { visitorName } : {}),
        ...(currentPage ? { currentPage } : {}),
      },
      create: {
        sessionToken,
        visitorName: visitorName || "Visitor",
        currentPage: currentPage || "",
        visitorIp,
        userAgent: ua,
      },
    });
    return res.json({ success: true, data: { id: session.id, visitorName: session.visitorName } });
  } catch (err) {
    console.error("chat/start error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/chat/history/:token ────────────────────────────────────────────
router.get("/history/:token", async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const session = await prisma.chatSession.findUnique({
      where: { sessionToken: token as string },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!session) return res.json({ success: true, data: [] });

    return res.json({ success: true, data: session.messages });
  } catch (err) {
    console.error("chat/history error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/chat/message ──────────────────────────────────────────────────
// Accepts multipart/form-data (with optional images) OR JSON (text-only).
// Fields: sessionToken, content?, visitorName?, currentPage?, images[] (files)
router.post("/message", uploadChatImages, async (req: Request, res: Response) => {
  const { sessionToken, content, visitorName, currentPage } = req.body as {
    sessionToken?: string;
    content?: string;
    visitorName?: string;
    currentPage?: string;
  };

  const files = req.files as Express.Multer.File[];
  const imageUrls: string[] = files?.map((f: any) => f.path) ?? [];
  const contentText = (content ?? "").trim();

  if (!sessionToken || (!contentText && imageUrls.length === 0)) {
    return res.status(400).json({ success: false, message: "sessionToken and content or image required" });
  }

  const visitorIp = getVisitorIp(req);

  try {
    // Upsert session — always update currentPage + IP
    const session = await prisma.chatSession.upsert({
      where: { sessionToken },
      update: {
        updatedAt: new Date(),
        visitorIp,
        ...(visitorName ? { visitorName } : {}),
        ...(currentPage ? { currentPage } : {}),
      },
      create: {
        sessionToken,
        visitorName: visitorName || "Visitor",
        currentPage: currentPage || "",
        visitorIp,
        userAgent: (req.headers["user-agent"] as string) || "",
      },
    });

    // Store message
    const msg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        senderType: "visitor",
        content: contentText,
        images: imageUrls,
      },
    });

    // Forward to admin WhatsApp
    const adminJids = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
    if (adminJids.length > 0) {
      const shortToken = sessionToken.slice(0, 8).toUpperCase();
      const displayPage = currentPage || session.currentPage;
      const displayIp = visitorIp || session.visitorIp;

      const infoLines: string[] = [];
      if (displayPage) infoLines.push(`📄 ${displayPage}`);
      if (displayIp)   infoLines.push(`🌐 ${displayIp}`);

      const visitorText = contentText
        ? `👤 ${session.visitorName}: ${contentText}`
        : `👤 ${session.visitorName}: 📷 *Sent ${imageUrls.length} image(s)*`;

      const imgLines = imageUrls.map((url, i) => `📷 Image ${i + 1}: ${url}`);

      const waText =
        `💬 *Chat [${shortToken}]*\n` +
        visitorText +
        (imgLines.length > 0 ? `\n${imgLines.join("\n")}` : "") +
        (infoLines.length > 0 ? `\n\n${infoLines.join("\n")}` : "") +
        `\n\n↩ *Swipe this message to reply*`;

      for (const jid of adminJids) {
        await sendWhatsAppMessage(jid, waText);
      }
    }

    return res.json({ success: true, data: msg });
  } catch (err) {
    console.error("chat/message error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/chat/page ─────────────────────────────────────────────────────
// Called by frontend on every route change. Updates currentPage and pings admin on WA.
// Body: { sessionToken: string, currentPage: string }
router.post("/page", async (req: Request, res: Response) => {
  const { sessionToken, currentPage } = req.body as {
    sessionToken?: string;
    currentPage?: string;
  };

  if (!sessionToken || !currentPage) {
    return res.status(400).json({ success: false, message: "sessionToken and currentPage required" });
  }

  try {
    const session = await prisma.chatSession.findUnique({ where: { sessionToken } });
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    // Skip if page hasn't changed
    if (session.currentPage === currentPage) {
      return res.json({ success: true });
    }

    await prisma.chatSession.update({
      where: { sessionToken },
      data: { currentPage, updatedAt: new Date() },
    });

    // Notify admin on WhatsApp
    const adminJids = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
    if (adminJids.length > 0) {
      const shortToken = sessionToken.slice(0, 8).toUpperCase();
      const waText = `👁️ *[${shortToken}]* ${session.visitorName} → ${currentPage}`;
      for (const jid of adminJids) {
        await sendWhatsAppMessage(jid, waText);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("chat/page error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
