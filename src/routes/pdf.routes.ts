import { Router } from "express";
import {
  verifyPasscode,
  getPdfDocuments,
  getPdfDocument,
  createPdfDocument,
  updatePdfDocument,
  deletePdfDocument,
  servePdfFile,
} from "../controllers/pdf.controller.js";
import { adminAuthFlexible } from "../middleware/adminAuthFlexible.js";
import { uploadPdf } from "../middleware/upload.js";

const router = Router();

// Public routes (no authentication required)
router.post("/verify-passcode", verifyPasscode);
router.get("/documents", getPdfDocuments);
router.get("/documents/:id", getPdfDocument);

// Serve PDF — verifies JWT then proxies from Cloudinary
// Two routes: with and without a friendly filename suffix for browser display
router.get("/serve/:id/:filename", servePdfFile);
router.get("/serve/:id", servePdfFile);

// Admin routes (API key OR admin role required)
router.post("/documents", adminAuthFlexible, uploadPdf, createPdfDocument);
router.put("/documents/:id", adminAuthFlexible, updatePdfDocument);
router.delete("/documents/:id", adminAuthFlexible, deletePdfDocument);

export default router;
