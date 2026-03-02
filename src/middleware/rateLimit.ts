import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

/**
 * Auth endpoints — login, register, OTP, password reset.
 * Strict: 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please wait 15 minutes and try again." },
});

/**
 * General authenticated API endpoints.
 * Moderate: 200 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down and try again shortly." },
});

/**
 * Public / unauthenticated endpoints (contact, newsletter, public properties).
 * Moderate: 30 requests per 15 minutes per IP.
 */
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
