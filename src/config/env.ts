import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  ADMIN_API_KEY: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000").transform(url => url.replace(/\/+$/, '')),
  // Email configuration (optional - app works without it)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  APP_NAME: z.string().optional(),
  APP_URL: z.string().optional(),
  // Cloudinary (image storage)
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  // Admin notifications
  ADMIN_EMAIL: z.string().optional(),
  // IP Geolocation (optional - free tier: 50k requests/month without token)
  IPINFO_TOKEN: z.string().optional(),
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  // PDF Access Passcodes (comma-separated, up to 10)
  PDF_ACCESS_PASSCODES: z.string().min(1).optional(),
  // PDF Token Expiry (e.g., "1h", "30m", "2h")
  PDF_TOKEN_EXPIRY: z.string().default("1h"),
});

export const env = envSchema.parse(process.env);
