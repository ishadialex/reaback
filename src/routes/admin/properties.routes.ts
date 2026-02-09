import { Router } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import { uploadMultiple } from "../../middleware/upload.js";
import { getAll, getOne, create, update, remove, hardDelete } from "../../controllers/admin/properties.controller.js";

const router = Router();

router.use(adminAuthFlexible);

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", uploadMultiple, create);
router.put("/:id", uploadMultiple, update);
router.delete("/:id", remove);
router.delete("/:id/permanent", hardDelete);

export default router;
