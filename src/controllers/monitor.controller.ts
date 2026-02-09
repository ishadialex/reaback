import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success } from "../utils/response.js";

const startTime = Date.now();

export async function getHealth(_req: Request, res: Response) {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
}

export async function getMetrics(_req: Request, res: Response) {
  try {
    const [
      userCount,
      sessionCount,
      activeSessionCount,
      ticketCount,
      openTicketCount,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.session.count(),
      prisma.session.count({ where: { isActive: true } }),
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: "open" } }),
    ]);

    return success(res, {
      uptime: {
        seconds: Math.floor(process.uptime()),
        since: new Date(startTime).toISOString(),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: {
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        },
      },
      database: {
        users: userCount,
        sessions: sessionCount,
        activeSessions: activeSessionCount,
        supportTickets: ticketCount,
        openTickets: openTicketCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Metrics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch metrics",
    });
  }
}

export async function getDatabaseStatus(_req: Request, res: Response) {
  try {
    const start = Date.now();
    // Simple ping test for MongoDB
    await prisma.user.findFirst({ take: 1 });
    const responseTime = Date.now() - start;

    return success(res, {
      connected: true,
      responseTime: `${responseTime}ms`,
      provider: "mongodb",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database status error:", error);
    return res.status(503).json({
      success: false,
      connected: false,
      error: "Database connection failed",
    });
  }
}