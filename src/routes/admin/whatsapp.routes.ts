import { Router, Request, Response } from "express";
import qrcode from "qrcode";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getWhatsAppStatus, startWhatsApp } from "../../services/whatsapp.service.js";
import { clearMongoAuthState } from "../../services/waAuthStore.service.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

/**
 * GET /api/admin/whatsapp/status
 * Returns connection state so the admin UI can show connected/disconnected.
 */
router.get("/status", (_req: Request, res: Response) => {
  const { connected, hasQR } = getWhatsAppStatus();
  res.json({ success: true, data: { connected, hasQR } });
});

/**
 * GET /api/admin/whatsapp/qr
 * Returns the current QR code as a base64 PNG data URL.
 * Admin scans this once with their phone to link the WhatsApp number.
 */
router.get("/qr", async (_req: Request, res: Response) => {
  const { connected, qr } = getWhatsAppStatus();

  if (connected) {
    return res.json({ success: true, data: { connected: true, qr: null } });
  }

  if (!qr) {
    return res.json({
      success: false,
      message: "QR not ready yet — WhatsApp is still initialising. Try again in a few seconds.",
      data: { connected: false, qr: null },
    });
  }

  try {
    const dataUrl = await qrcode.toDataURL(qr);
    return res.json({ success: true, data: { connected: false, qr: dataUrl } });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to generate QR image" });
  }
});

/**
 * GET /api/admin/whatsapp/qr-image
 * Returns the QR as a raw PNG — opens directly in Postman / browser without decoding.
 */
router.get("/qr-image", async (_req: Request, res: Response) => {
  const { connected, qr } = getWhatsAppStatus();

  if (connected) {
    return res.status(200).send("WhatsApp already connected — no QR needed.");
  }

  if (!qr) {
    return res.status(202).send("QR not ready yet — try again in a few seconds.");
  }

  try {
    const buf = await qrcode.toBuffer(qr);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.send(buf);
  } catch {
    return res.status(500).send("Failed to generate QR image");
  }
});

/**
 * POST /api/admin/whatsapp/reset
 * Clears stale MongoDB auth state and restarts WhatsApp so a fresh QR is generated.
 * Use this to recover from "Bad MAC" / session corruption errors.
 */
router.post("/reset", async (_req: Request, res: Response) => {
  try {
    await clearMongoAuthState();
    // Give it a moment then re-init (non-blocking — QR will appear in server logs)
    setTimeout(() => startWhatsApp(), 1000);
    return res.json({ success: true, message: "Auth state cleared. WhatsApp is restarting — scan the new QR from /api/admin/whatsapp/qr-image in ~5 seconds." });
  } catch (err) {
    console.error("📱 whatsapp/reset error:", err);
    return res.status(500).json({ success: false, message: "Failed to reset WhatsApp auth state" });
  }
});

export default router;
