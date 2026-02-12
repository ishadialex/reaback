import { Response } from "express";
import { env } from "../config/env.js";

const isProduction = env.NODE_ENV === "production";

/**
 * Cookie configuration for httpOnly cookies
 */
const cookieConfig = {
  httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
  secure: isProduction, // Only sent over HTTPS in production
  sameSite: "strict" as const, // CSRF protection
  path: "/", // Available for all routes
};

/**
 * Set access token as httpOnly cookie
 */
export function setAccessTokenCookie(res: Response, token: string): void {
  const maxAge = 15 * 60 * 1000; // 15 minutes in milliseconds

  res.cookie("access_token", token, {
    ...cookieConfig,
    maxAge,
  });
}

/**
 * Set refresh token as httpOnly cookie
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  res.cookie("refresh_token", token, {
    ...cookieConfig,
    maxAge,
  });
}

/**
 * Clear all authentication cookies (logout)
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { ...cookieConfig });
  res.clearCookie("refresh_token", { ...cookieConfig });
  res.clearCookie("pdf_access_token", { ...cookieConfig });
}

/**
 * Get access token from request cookies
 */
export function getAccessTokenFromCookies(req: any): string | null {
  return req.cookies?.access_token || null;
}

/**
 * Get refresh token from request cookies
 */
export function getRefreshTokenFromCookies(req: any): string | null {
  return req.cookies?.refresh_token || null;
}
