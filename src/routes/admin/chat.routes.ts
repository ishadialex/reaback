import { Router, Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getIO } from "../../services/socket.service.js";

const router = Router();
router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

/**
 * PATCH /api/admin/chat/status
 * Body: { isOnline: boolean }
 * Toggles the chat widget online/offline. Broadcasts to all connected widgets instantly.
 */
router.patch("/status", async (req: Request, res: Response) => {
  const { isOnline } = req.body as { isOnline?: boolean };

  if (typeof isOnline !== "boolean") {
    return res.status(400).json({ success: false, message: "isOnline (boolean) required" });
  }

  try {
    // Upsert — create the single config record on first use
    const existing = await prisma.chatConfig.findFirst();
    const config = existing
      ? await prisma.chatConfig.update({ where: { id: existing.id }, data: { isOnline } })
      : await prisma.chatConfig.create({ data: { isOnline } });

    // Broadcast to all chat widget clients so they update instantly
    const io = getIO();
    if (io) {
      io.of("/chat").emit("chat_status", { isOnline });
    }

    return res.json({ success: true, data: { isOnline: config.isOnline } });
  } catch (err) {
    console.error("admin chat/status error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/admin/chat/status
 * Returns current online/offline status.
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const config = await prisma.chatConfig.findFirst();
    return res.json({ success: true, data: { isOnline: config?.isOnline ?? true } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
