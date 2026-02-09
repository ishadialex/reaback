import { Router } from "express";
import {
  getHealth,
  getMetrics,
  getDatabaseStatus,
} from "../controllers/monitor.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = Router();

// Public health check
router.get("/health", getHealth);

// Protected monitoring endpoints (admin only)
router.get("/metrics", authenticate, adminAuth, getMetrics);
router.get("/database", authenticate, adminAuth, getDatabaseStatus);

export default router;