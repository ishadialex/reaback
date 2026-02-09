import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getSessions, revokeSession } from "../controllers/sessions.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getSessions);
router.delete("/:id", revokeSession);

export default router;
