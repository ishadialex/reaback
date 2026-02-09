import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return success(res, notifications);
  } catch (err) {
    return error(res, "Failed to fetch notifications", 500);
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const notification = await prisma.notification.findUnique({
      where: { id, userId },
    });

    if (!notification) {
      return error(res, "Notification not found", 404);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return success(res, updated, "Notification marked as read");
  } catch (err) {
    return error(res, "Failed to update notification", 500);
  }
}

export async function markAllAsRead(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return success(res, { count: result.count }, "All notifications marked as read");
  } catch (err) {
    return error(res, "Failed to update notifications", 500);
  }
}

export async function clearAllNotifications(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    return success(res, { count: result.count }, "All notifications cleared");
  } catch (err) {
    return error(res, "Failed to clear notifications", 500);
  }
}
