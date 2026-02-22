import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  getAllFundOperations,
  approveFundOperation,
  rejectFundOperation,
} from "../../controllers/admin/fundOperations.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

router.get("/", getAllFundOperations);
router.post("/:id/approve", approveFundOperation);
router.post("/:id/reject", rejectFundOperation);

export default router;
