import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getInfo, getStats, getList } from "../controllers/referral.controller.js";

const router = Router();

router.use(authenticate);

router.get("/info", getInfo);
router.get("/stats", getStats);
router.get("/list", getList);

export default router;
