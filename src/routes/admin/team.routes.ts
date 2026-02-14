import { Router } from "express";
import { adminAuth } from "../../middleware/adminAuth.js";
import { uploadTeamImage } from "../../middleware/upload.js";
import { getAll, create, update, remove } from "../../controllers/admin/team.controller.js";

const router = Router();

router.use(adminAuth);

router.get("/", getAll);
router.post("/", uploadTeamImage, create);
router.put("/:id", uploadTeamImage, update);
router.delete("/:id", remove);

export default router;
