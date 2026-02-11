import { Router } from "express";
import { verifyPasscode } from "../controllers/pdf.controller.js";

const router = Router();

/**
 * POST /api/pdf/verify-passcode
 * Verify PDF access passcode (no authentication required)
 */
router.post("/verify-passcode", verifyPasscode);

export default router;
