import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().min(1, "Phone number is required"),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Verification code must be 6 digits").regex(/^\d{6}$/, "Code must be numeric"),
});

export const resendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
