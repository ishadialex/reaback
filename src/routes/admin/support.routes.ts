import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadTicketReplyImages } from "../../middleware/upload.js";
import {
  listTickets,
  getTicket,
  replyTicket,
  updateTicketStatus,
} from "../../controllers/admin/support.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

router.get("/", listTickets);
router.get("/:id", getTicket);
router.post("/:id/reply", uploadTicketReplyImages, replyTicket);
router.patch("/:id/status", updateTicketStatus);

export default router;
