import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { depositSchema, withdrawSchema } from "../validators/fund.schema.js";
import { deposit, withdraw, getHistory } from "../controllers/fund.controller.js";

const router = Router();

router.use(authenticate);

router.post("/deposit", validate(depositSchema), deposit);
router.post("/withdraw", validate(withdrawSchema), withdraw);
router.get("/history", getHistory);

export default router;
