import { z } from "zod";

export const createTestimonialSchema = z.object({
  name: z.string().min(1).max(100),
  designation: z.string().min(1).max(200),
  content: z.string().min(1).max(1000),
  image: z.string().min(1).max(1000),
  star: z.number().int().min(1).max(5).optional().default(5),
});

export const updateTestimonialSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  designation: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(1000).optional(),
  image: z.string().min(1).max(1000).optional(),
  star: z.number().int().min(1).max(5).optional(),
  isActive: z.boolean().optional(),
});
