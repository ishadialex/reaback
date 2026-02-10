import { z } from "zod";

export const createTransferSchema = z.object({
  recipientEmail: z.string().email("Invalid recipient email"),
  amount: z.number().positive("Amount must be greater than 0"),
  note: z.string().max(500).optional().default(""),
  twoFactorCode: z
    .string()
    .length(6, "2FA code must be 6 digits")
    .regex(/^\d{6}$/, "2FA code must contain only digits"),
});
