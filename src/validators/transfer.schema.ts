import { z } from "zod";

export const createTransferSchema = z.object({
  recipientEmail: z.string().email("Invalid recipient email"),
  amount: z.number().positive("Amount must be greater than 0"),
  note: z.string().max(500).optional().default(""),
});
