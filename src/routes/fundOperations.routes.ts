import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import {
  createDeposit,
  createWithdrawal,
  uploadReceipt,
  getFundOperations,
  getFundOperationById,
  getWithdrawalAuthorizationStatus,
} from "../controllers/fundOperations.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(authenticate);

const depositSchema = z.object({
  method: z.enum(["bank", "crypto", "card"]),
  amount: z.number().min(100).max(10000000),
  details: z.record(z.unknown()).optional(),
});

const withdrawalSchema = z.object({
  method: z.enum(["bank", "crypto"]),
  amount: z.number().positive(),
  details: z.record(z.unknown()).optional(),
  twoFactorCode: z
    .string()
    .length(6, "2FA code must be 6 digits")
    .regex(/^\d{6}$/, "2FA code must contain only digits"),
});

router.get("/withdrawal-authorization", getWithdrawalAuthorizationStatus);
router.post("/deposit", validate(depositSchema), createDeposit);
router.post("/withdrawal", validate(withdrawalSchema), createWithdrawal);
router.post("/upload-receipt", upload.single("receipt"), uploadReceipt);
router.get("/", getFundOperations);
router.get("/:id", getFundOperationById);

export default router;
