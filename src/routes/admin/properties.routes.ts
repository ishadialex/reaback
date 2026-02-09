import { Router } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import { validate } from "../../middleware/validate.js";
import { createPropertySchema, updatePropertySchema } from "../../validators/admin/properties.schema.js";
import { getAll, getOne, create, update, remove, hardDelete } from "../../controllers/admin/properties.controller.js";

const router = Router();

router.use(adminAuthFlexible);

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", validate(createPropertySchema), create);
router.put("/:id", validate(updatePropertySchema), update);
router.delete("/:id", remove);
router.delete("/:id/permanent", hardDelete);

export default router;
