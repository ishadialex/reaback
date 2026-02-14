import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  createReview,
  updateReview,
  deleteReview,
  getMyReviews,
  getAllReviews,
  approveReview,
} from "../controllers/reviews.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── User Routes ──────────────────────────────────────────────────────────────

/** POST /api/reviews/:propertyId  — submit a review */
router.post("/:propertyId", createReview);

/** GET  /api/reviews/my           — get own reviews */
router.get("/my", getMyReviews);

/** PUT  /api/reviews/:reviewId    — edit own review */
router.put("/:reviewId", updateReview);

/** DELETE /api/reviews/:reviewId  — delete own review (or admin) */
router.delete("/:reviewId", deleteReview);

// ── Admin Routes ─────────────────────────────────────────────────────────────

/** GET   /api/reviews/admin/all              — all reviews */
router.get("/admin/all", requireRole("admin"), getAllReviews);

/** PATCH /api/reviews/admin/:reviewId/approve — approve / reject */
router.patch("/admin/:reviewId/approve", requireRole("admin"), approveReview);

export default router;
