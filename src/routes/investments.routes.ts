import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getUserInvestments, createInvestment, createPropertyInvestment } from "../controllers/investments.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getUserInvestments);
router.post("/", createInvestment);
router.post("/property", createPropertyInvestment);

export default router;
