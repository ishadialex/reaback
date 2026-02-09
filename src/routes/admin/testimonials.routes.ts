import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth.js";
import { validate } from "../../middleware/validate.js";
import { createTestimonialSchema, updateTestimonialSchema } from "../../validators/admin/testimonials.schema.js";
import { getAll, create, update, remove } from "../../controllers/admin/testimonials.controller.js";

const router = Router();

router.use(adminAuth);

router.get("/", getAll);
router.post("/", validate(createTestimonialSchema), create);
router.put("/:id", validate(updateTestimonialSchema), update);
router.delete("/:id", remove);

export default router;
