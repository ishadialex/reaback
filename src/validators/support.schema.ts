import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  category: z.string().min(1, "Category is required").max(50),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().min(20, "Message must be at least 20 characters").max(5000),
  attachmentIds: z.array(z.string()).optional(),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  attachmentIds: z.array(z.string()).optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});
