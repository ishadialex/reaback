import { z } from "zod";

export const createTeamMemberSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  image: z.string().min(1).max(1000),
  instagram: z.string().url().optional().nullable(),
  order: z.number().int().min(0).max(100).optional().default(0),
});

export const updateTeamMemberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(100).optional(),
  image: z.string().min(1).max(1000).optional(),
  instagram: z.string().url().optional().nullable(),
  order: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
