import { Router } from "express";
import {
  subscribe,
  unsubscribe,
  getSubscribers,
  exportCSV,
  getStats,
  removeSubscriber,
} from "../controllers/newsletter.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// ──────────────────────────────────────────────
// Public Routes
// ──────────────────────────────────────────────

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
router.post("/subscribe", subscribe);

/**
 * @route   POST /api/newsletter/unsubscribe
 * @desc    Unsubscribe from newsletter
 * @access  Public
 */
router.post("/unsubscribe", unsubscribe);

// ──────────────────────────────────────────────
// Admin Routes (Protected)
// ──────────────────────────────────────────────

/**
 * @route   GET /api/newsletter/subscribers
 * @desc    Get all newsletter subscribers
 * @access  Admin only
 */
router.get("/subscribers", authenticate, requireRole("admin"), getSubscribers);

/**
 * @route   GET /api/newsletter/export
 * @desc    Export subscribers to CSV
 * @access  Admin only
 */
router.get("/export", authenticate, requireRole("admin"), exportCSV);

/**
 * @route   GET /api/newsletter/stats
 * @desc    Get subscriber statistics
 * @access  Admin only
 */
router.get("/stats", authenticate, requireRole("admin"), getStats);

/**
 * @route   DELETE /api/newsletter/subscribers/:email
 * @desc    Delete a subscriber
 * @access  Admin only
 */
router.delete("/subscribers/:email", authenticate, requireRole("admin"), removeSubscriber);

export default router;
