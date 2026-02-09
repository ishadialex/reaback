import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { updateSettingsSchema, changePasswordSchema } from "../validators/profile.schema.js";
import { getSettings, updateSettings, changePassword, deleteAccount } from "../controllers/settings.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getSettings);
router.put("/", validate(updateSettingsSchema), updateSettings);
router.put("/password", validate(changePasswordSchema), changePassword);
router.delete("/account", deleteAccount);

export default router;
