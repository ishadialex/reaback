import { Router } from "express";
import { getTeamMembers, getTestimonials, getInvestmentOptions } from "../controllers/public.controller.js";

const router = Router();

router.get("/team", getTeamMembers);
router.get("/testimonials", getTestimonials);
router.get("/investments", getInvestmentOptions);

export default router;
