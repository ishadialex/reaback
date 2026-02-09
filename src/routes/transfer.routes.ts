import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { createTransferSchema } from "../validators/transfer.schema.js";
import { getTransfers, createTransfer } from "../controllers/transfer.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getTransfers);
router.post("/", validate(createTransferSchema), createTransfer);

export default router;
