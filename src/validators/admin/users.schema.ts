import { z } from "zod";

export const updateUserRoleSchema = z.object({
  role: z.enum(["user", "admin", "superadmin"]),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateUserKycSchema = z.object({
  kycStatus: z.enum(["none", "pending", "verified", "rejected"]),
});
