import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getPaymentMethods, getPaymentMethodById } from "../controllers/paymentMethods.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getPaymentMethods);
router.get("/:id", getPaymentMethodById);

export default router;
