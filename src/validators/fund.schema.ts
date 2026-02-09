import { z } from "zod";

export const depositSchema = z.object({
  method: z.enum(["card", "bank", "crypto"]),
  amount: z.number().positive("Amount must be greater than 0"),
  details: z.record(z.unknown()).optional().default({}),
});

export const withdrawSchema = z.object({
  method: z.enum(["card", "bank", "crypto"]),
  amount: z.number().positive("Amount must be greater than 0"),
  details: z.record(z.unknown()).default({}),
});
