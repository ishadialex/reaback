import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getKYCStatus, submitKYC, updateKYC, uploadKYCDocument } from "../controllers/kyc.controller.js";
import { uploadKYCDocument as uploadMiddleware } from "../middleware/upload.js";

const router = Router();

// All KYC routes require authentication
router.use(authenticate);

// GET /api/kyc/status - Get user's KYC status
router.get("/status", getKYCStatus);

// POST /api/kyc/upload-document - Upload KYC document
router.post("/upload-document", uploadMiddleware, uploadKYCDocument);

// POST /api/kyc/submit - Submit KYC documents
router.post("/submit", submitKYC);

// PUT /api/kyc/update - Update KYC information
router.put("/update", updateKYC);

export default router;
