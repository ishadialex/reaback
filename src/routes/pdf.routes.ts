import { Router } from "express";
import {
  verifyPasscode,
  getPdfDocuments,
  getPdfDocument,
  createPdfDocument,
  updatePdfDocument,
  deletePdfDocument,
} from "../controllers/pdf.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { adminAuthFlexible } from "../middleware/adminAuthFlexible.js";

const router = Router();

// Public routes (no authentication required)
/**
 * POST /api/pdf/verify-passcode
 * Verify PDF access passcode
 */
router.post("/verify-passcode", verifyPasscode);

/**
 * GET /api/pdf/documents
 * Get all active PDF documents for menu display
 */
router.get("/documents", getPdfDocuments);

/**
 * GET /api/pdf/documents/:id
 * Get single PDF document by ID
 */
router.get("/documents/:id", getPdfDocument);

// Admin routes (API key OR admin role required)
/**
 * POST /api/pdf/documents
 * Create new PDF document (admin only)
 */
router.post("/documents", adminAuthFlexible, createPdfDocument);

/**
 * PUT /api/pdf/documents/:id
 * Update PDF document (admin only)
 */
router.put("/documents/:id", adminAuthFlexible, updatePdfDocument);

/**
 * DELETE /api/pdf/documents/:id
 * Deactivate PDF document (admin only)
 */
router.delete("/documents/:id", adminAuthFlexible, deletePdfDocument);

export default router;
