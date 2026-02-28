import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  getAllPaymentWallets,
  createPaymentWallet,
  updatePaymentWallet,
  togglePaymentWallet,
  deletePaymentWallet,
} from "../../controllers/admin/paymentWallets.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

router.get("/", getAllPaymentWallets);
router.post("/", createPaymentWallet);
router.patch("/:id", updatePaymentWallet);
router.patch("/:id/toggle", togglePaymentWallet);
router.delete("/:id", deletePaymentWallet);

export default router;
