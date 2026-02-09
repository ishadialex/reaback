import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getNotifications, markAsRead, markAllAsRead, clearAllNotifications } from "../controllers/notifications.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getNotifications);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);
router.delete("/", clearAllNotifications);

export default router;
