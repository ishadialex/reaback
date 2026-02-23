import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { submitBid, submitBuyNow } from "../controllers/bid.controller.js";

const router = Router();

router.use(authenticate);
router.post("/:id/bid", submitBid);
router.post("/:id/buy", submitBuyNow);

export default router;
