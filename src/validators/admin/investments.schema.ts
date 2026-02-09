import { z } from "zod";

export const createInvestmentSchema = z.object({
  title: z.string().min(1).max(200),
  image: z.string().min(1).max(1000),
  minInvestment: z.string().min(1).max(50),
  description: z.string().min(1).max(2000),
  link: z.string().min(1).max(2000),
  order: z.number().int().min(0).max(100).optional().default(0),
});

export const updateInvestmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  image: z.string().min(1).max(1000).optional(),
  minInvestment: z.string().min(1).max(50).optional(),
  description: z.string().min(1).max(2000).optional(),
  link: z.string().min(1).max(2000).optional(),
  order: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
