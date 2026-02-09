import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { createTicketSchema, replyTicketSchema, updateTicketSchema } from "../validators/support.schema.js";
import { getTickets, createTicket, getTicket, updateTicket, replyTicket, uploadAttachment } from "../controllers/support.controller.js";
import { uploadAttachment as uploadMiddleware } from "../middleware/upload.js";

const router = Router();

router.use(authenticate);

router.get("/", getTickets);
router.post("/", validate(createTicketSchema), createTicket);
router.post("/upload", uploadMiddleware, uploadAttachment);
router.get("/:id", getTicket);
router.put("/:id", validate(updateTicketSchema), updateTicket);
router.post("/:id/reply", validate(replyTicketSchema), replyTicket);

export default router;
