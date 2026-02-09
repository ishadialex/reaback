import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  updateUserKycSchema,
} from "../../validators/admin/users.schema.js";
import {
  getAllUsers,
  getUser,
  updateUserRole,
  updateUserStatus,
  updateUserKyc,
  getUserStats,
} from "../../controllers/admin/users.controller.js";

const router = Router();

// All routes require authentication + admin/superadmin role
router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

router.get("/", getAllUsers);
router.get("/stats", getUserStats);
router.get("/:id", getUser);
router.patch("/:id/role", validate(updateUserRoleSchema), updateUserRole);
router.patch("/:id/status", validate(updateUserStatusSchema), updateUserStatus);
router.patch("/:id/kyc", validate(updateUserKycSchema), updateUserKyc);

export default router;
