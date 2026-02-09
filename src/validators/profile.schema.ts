import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().max(20).optional(),
  nationality: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  profilePhoto: z.string().max(500).nullable().optional(),
  bio: z.string().max(500).optional(),
  occupation: z.string().max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  loginAlerts: z.boolean().optional(),
  sessionTimeout: z.number().int().min(0).max(480).optional(), // 0 = never, 2+ = minutes
});
