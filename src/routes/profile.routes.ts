import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { updateProfileSchema } from "../validators/profile.schema.js";
import { getProfile, updateProfile, uploadPhoto } from "../controllers/profile.controller.js";
import { uploadSingle } from "../middleware/upload.js";

const router = Router();

router.use(authenticate);

router.get("/", getProfile);
router.put("/", validate(updateProfileSchema), updateProfile);
router.post("/upload", uploadSingle, uploadPhoto);

export default router;
