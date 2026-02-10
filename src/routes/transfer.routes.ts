import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { createTransferSchema } from "../validators/transfer.schema.js";
import {
  getTransfers,
  createTransfer,
  getTransferAuthorizationStatus,
} from "../controllers/transfer.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getTransfers);
router.get("/authorization-status", getTransferAuthorizationStatus);
router.post("/", validate(createTransferSchema), createTransfer);

export default router;
