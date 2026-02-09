import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { error } from "../utils/response.js";

/**
 * Middleware to check if authenticated user has required role(s)
 * Must be used AFTER the authenticate middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure user is authenticated first
      if (!req.userId) {
        return error(res, "Authentication required", 401);
      }

      // Fetch user with role
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true, isActive: true },
      });

      if (!user) {
        return error(res, "User not found", 404);
      }

      if (!user.isActive) {
        return error(res, "Account is deactivated", 403);
      }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(user.role)) {
        return error(res, "Insufficient permissions", 403);
      }

      next();
    } catch (err) {
      console.error("Role check error:", err);
      return error(res, "Authorization failed", 500);
    }
  };
}
