import { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Cookie configuration for httpOnly cookies
 */
const cookieConfig = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  path: "/",
};

/**
 * Set access token as httpOnly cookie
 */
export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    ...cookieConfig,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Set refresh token as httpOnly cookie
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie("refresh_token", token, {
    ...cookieConfig,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Set both auth cookies using a single combined cookie.
 * rememberMe=true  → 3-day cookie TTL
 * rememberMe=false → 30-minute cookie TTL (session-like)
 * This avoids issues with proxies dropping multiple Set-Cookie headers.
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, rememberMe = false): void {
  const refreshMaxAge = rememberMe
    ? 3 * 24 * 60 * 60 * 1000  // 3 days
    : 30 * 60 * 1000;           // 30 minutes

  const authData = JSON.stringify({ at: accessToken, rt: refreshToken });
  res.cookie("auth_tokens", authData, {
    ...cookieConfig,
    maxAge: refreshMaxAge,
  });
  res.cookie("access_token", accessToken, {
    ...cookieConfig,
    maxAge: 15 * 60 * 1000, // always 15 min
  });
  res.cookie("refresh_token", refreshToken, {
    ...cookieConfig,
    maxAge: refreshMaxAge,
  });
}

/**
 * Clear all authentication cookies (logout)
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { ...cookieConfig });
  res.clearCookie("refresh_token", { ...cookieConfig });
  res.clearCookie("auth_tokens", { ...cookieConfig });
  res.clearCookie("pdf_access_token", { ...cookieConfig });
}

/**
 * Get access token from request cookies
 * Tries individual cookie first, then falls back to combined cookie
 */
export function getAccessTokenFromCookies(req: any): string | null {
  if (req.cookies?.access_token) return req.cookies.access_token;
  // Fallback: extract from combined cookie
  if (req.cookies?.auth_tokens) {
    try {
      const parsed = JSON.parse(req.cookies.auth_tokens);
      return parsed.at || null;
    } catch { return null; }
  }
  return null;
}

/**
 * Get refresh token from request cookies
 * Tries individual cookie first, then falls back to combined cookie
 */
export function getRefreshTokenFromCookies(req: any): string | null {
  if (req.cookies?.refresh_token) return req.cookies.refresh_token;
  // Fallback: extract from combined cookie
  if (req.cookies?.auth_tokens) {
    try {
      const parsed = JSON.parse(req.cookies.auth_tokens);
      return parsed.rt || null;
    } catch { return null; }
  }
  return null;
}
