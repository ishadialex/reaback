import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../config/database.js";
import { error } from "../utils/response.js";

/**
 * Flexible admin authentication middleware
 * Supports BOTH:
 * 1. API Key authentication (legacy)
 * 2. JWT with admin/superadmin role (new)
 */
export async function adminAuthFlexible(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return error(res, "Authorization header is required", 401);
  }

  const token = header.slice(7);

  // Try API Key authentication first (for backward compatibility)
  const expectedApiKey = env.ADMIN_API_KEY;
  const providedBuf = Buffer.from(token, "utf-8");
  const expectedBuf = Buffer.from(expectedApiKey, "utf-8");

  if (providedBuf.length === expectedBuf.length) {
    try {
      if (crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        // API key is valid
        return next();
      }
    } catch {
      // Not a valid API key, continue to JWT check
    }
  }

  // Try JWT authentication with role check
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;

    // Fetch user and check role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, isActive: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    if (!user.isActive) {
      return error(res, "Account is deactivated", 403);
    }

    if (user.role !== "admin" && user.role !== "superadmin") {
      return error(res, "Insufficient permissions. Admin role required.", 403);
    }

    // User is admin, allow access
    return next();
  } catch {
    return error(res, "Invalid or expired token, and not a valid API key", 401);
  }
}
