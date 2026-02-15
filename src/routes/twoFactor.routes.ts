import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  setup2FA,
  enable2FA,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
  requireLogin2FA,
} from "../controllers/twoFactor.controller.js";

const router = Router();

// All 2FA routes require authentication
router.use(authenticate);

// Get 2FA status
router.get("/status", get2FAStatus);

// Setup 2FA (generate secret + QR code)
router.post("/setup", setup2FA);

// Enable 2FA (verify code and enable)
router.post("/enable", enable2FA);

// Disable 2FA (requires password)
router.post("/disable", disable2FA);

// Regenerate backup codes (requires password)
router.post("/backup-codes/regenerate", regenerateBackupCodes);

// Toggle "Require 2FA on login"
router.post("/require-login", requireLogin2FA);

export default router;
