import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  getAllKYCSubmissions,
  getKYCSubmission,
  approveKYC,
  rejectKYC,
  getKYCStats,
} from "../../controllers/admin/kyc.controller.js";

const router = Router();

// All routes require authentication + admin/superadmin role
router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

// GET /api/admin/kyc/submissions - Get all KYC submissions (with filtering)
router.get("/submissions", getAllKYCSubmissions);

// GET /api/admin/kyc/stats - Get KYC statistics
router.get("/stats", getKYCStats);

// GET /api/admin/kyc/submissions/:id - Get single KYC submission details
router.get("/submissions/:id", getKYCSubmission);

// POST /api/admin/kyc/approve/:id - Approve KYC
router.post("/approve/:id", approveKYC);

// POST /api/admin/kyc/reject/:id - Reject KYC
router.post("/reject/:id", rejectKYC);

export default router;
