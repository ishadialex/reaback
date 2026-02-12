import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { error } from "../utils/response.js";
import { getAccessTokenFromCookies } from "../utils/cookies.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Try to get token from httpOnly cookie first (most secure)
  let token = getAccessTokenFromCookies(req);

  // Fall back to Authorization header for backwards compatibility
  if (!token) {
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      token = header.slice(7);
    }
  }

  if (!token) {
    error(res, "Authentication required", 401);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    error(res, "Invalid or expired token", 401);
    return;
  }
}
