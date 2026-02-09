import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";
import { createInvestmentSchema, updateInvestmentSchema } from "../../validators/admin/investments.schema.js";
import { getAll, create, update, remove } from "../../controllers/admin/investments.controller.js";

const router = Router();

router.use(adminAuth);

router.get("/", getAll);
router.post("/", validate(createInvestmentSchema), create);
router.put("/:id", validate(updateInvestmentSchema), update);
router.delete("/:id", remove);

export default router;
