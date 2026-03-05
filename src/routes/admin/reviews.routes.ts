import { Router } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import {
  adminListReviews,
  adminEditReview,
  adminDeleteReview,
  approveReview,
} from "../../controllers/reviews.controller.js";

const router = Router();

router.use(adminAuthFlexible);

router.get("/", adminListReviews);
router.patch("/:reviewId", adminEditReview);
router.delete("/:reviewId", adminDeleteReview);
router.patch("/:reviewId/approve", approveReview);

export default router;
