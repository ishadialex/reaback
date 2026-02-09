import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";
import { createTeamMemberSchema, updateTeamMemberSchema } from "../../validators/admin/team.schema.js";
import { getAll, create, update, remove } from "../../controllers/admin/team.controller.js";

const router = Router();

router.use(adminAuth);

router.get("/", getAll);
router.post("/", validate(createTeamMemberSchema), create);
router.put("/:id", validate(updateTeamMemberSchema), update);
router.delete("/:id", remove);

export default router;
