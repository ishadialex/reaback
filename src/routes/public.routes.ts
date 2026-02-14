import { Router } from "express";
import { getTeamMembers, getTestimonials, getInvestmentOptions } from "../controllers/public.controller.js";
import { getProperties, getProperty, getFeatured } from "../controllers/properties.controller.js";
import { getPublicReviews, getAllPublicReviews } from "../controllers/reviews.controller.js";

const router = Router();

router.get("/team", getTeamMembers);
router.get("/testimonials", getTestimonials);
router.get("/investments", getInvestmentOptions);
router.get("/properties", getProperties);
router.get("/properties/featured", getFeatured);
router.get("/properties/:id", getProperty);
router.get("/properties/:propertyId/reviews", getPublicReviews);
router.get("/reviews", getAllPublicReviews);

export default router;
