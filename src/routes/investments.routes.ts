import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getUserInvestments, createInvestment, createPropertyInvestment, checkUserPropertyInvestment } from "../controllers/investments.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getUserInvestments);
router.post("/", createInvestment);
router.get("/property/:propertyId/check", checkUserPropertyInvestment);
router.post("/property", createPropertyInvestment);

export default router;
