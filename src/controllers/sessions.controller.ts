import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function getSessions(req: Request, res: Response) {
  try {
    // For GET requests, read token from query or header instead of body
    const currentToken = (req.query.refreshToken as string) ||
                         req.headers['x-refresh-token'] as string;

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.userId,
        isActive: true,
      },
      select: {
        id: true,
        device: true,
        browser: true,
        location: true,
        lastActive: true,
        token: true,
      },
      orderBy: { lastActive: "desc" },
    });

    // Map sessions and mark current one
    // If no token provided, mark the most recent as current (first in list)
    const result = sessions.map(({ token, ...session }, index) => ({
      ...session,
      current: currentToken ? token === currentToken : index === 0,
    }));

    return success(res, result);
  } catch (err) {
    console.error("getSessions error:", err);
    return error(res, "Failed to fetch sessions", 500);
  }
}

export async function revokeSession(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    // RefreshToken is optional - can be in body, query, or header
    const currentToken = req.body?.refreshToken ||
                         req.query?.refreshToken as string ||
                         req.headers['x-refresh-token'] as string;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        token: true,
        isActive: true,
      },
    });

    if (!session || session.userId !== req.userId) {
      return error(res, "Session not found", 404);
    }

    if (!session.isActive) {
      return error(res, "Session is already revoked", 400);
    }

    if (currentToken && session.token === currentToken) {
      return error(res, "Cannot revoke your current session", 400);
    }

    await prisma.session.update({
      where: { id },
      data: { isActive: false },
    });

    return success(res, null, "Session revoked successfully");
  } catch (err) {
    console.error("revokeSession error:", err);
    return error(res, "Failed to revoke session", 500);
  }
}
