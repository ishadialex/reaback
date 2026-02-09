import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";
import {
  createInAppNotification,
  notifyAdminNewTicket,
  notifyAdminTicketReply,
} from "../services/notification.service.js";

const BASE_URL = env.APP_URL || `http://localhost:${env.PORT}`;

function formatAttachment(a: {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: Date;
}) {
  return {
    id: a.id,
    name: a.name,
    size: a.size,
    type: a.type,
    url: a.url.startsWith("http") ? a.url : `${BASE_URL}${a.url}`,
    uploadedAt: a.createdAt,
  };
}

export async function getTickets(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          include: { attachments: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formatted = tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      message: ticket.messages[0]?.message || "",
      attachments: ticket.messages[0]?.attachments.map(formatAttachment) || [],
      replyCount: Math.max(0, ticket._count.messages - 1),
    }));

    return success(res, formatted);
  } catch (err) {
    return error(res, "Failed to fetch tickets", 500);
  }
}

export async function createTicket(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const subject = req.body.subject as string;
    const category = req.body.category as string;
    const priority = req.body.priority as string;
    const message = req.body.message as string;
    const attachmentIds = req.body.attachmentIds as string[] | undefined;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject,
        category,
        priority,
        messages: {
          create: {
            senderId: userId,
            senderType: "user",
            message,
          },
        },
      },
      include: {
        messages: { include: { attachments: true } },
      },
    });

    // Link uploaded attachments to the created message
    if (attachmentIds?.length) {
      await prisma.fileAttachment.updateMany({
        where: { id: { in: attachmentIds }, userId },
        data: { messageId: ticket.messages[0].id },
      });
    }

    // Re-fetch with updated attachments
    const updatedMsg = await prisma.ticketMessage.findUnique({
      where: { id: ticket.messages[0].id },
      include: { attachments: true },
    });

    // Fetch user info for notifications
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const userName = user ? `${user.firstName} ${user.lastName}` : "User";

    // Send admin email notification (async, non-blocking)
    notifyAdminNewTicket(
      user?.email || "",
      userName,
      ticket.id,
      subject,
      category,
      priority,
      message
    ).catch(() => {});

    // Create in-app notification for the user
    createInAppNotification(
      userId,
      "support",
      "Ticket Created",
      `Your support ticket "${subject}" has been submitted.`
    ).catch(() => {});

    return success(
      res,
      {
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        message: updatedMsg?.message || "",
        attachments: updatedMsg?.attachments.map(formatAttachment) || [],
        replyCount: 0,
      },
      "Ticket created",
      201
    );
  } catch (err) {
    return error(res, "Failed to create ticket", 500);
  }
}

export async function getTicket(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        messages: {
          include: {
            attachments: true,
            sender: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return error(res, "Ticket not found", 404);
    }

    const [firstMessage, ...replyMessages] = ticket.messages;

    return success(res, {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      message: firstMessage?.message || "",
      attachments: firstMessage?.attachments.map(formatAttachment) || [],
      replies: replyMessages.map((msg) => ({
        id: msg.id,
        message: msg.message,
        isStaff: msg.senderType === "admin",
        authorName:
          msg.senderType === "admin"
            ? "Support Team"
            : `${msg.sender.firstName} ${msg.sender.lastName}`,
        createdAt: msg.createdAt,
        attachments: msg.attachments.map(formatAttachment),
      })),
    });
  } catch (err) {
    return error(res, "Failed to fetch ticket", 500);
  }
}

export async function updateTicket(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const status = req.body.status as string;

    const existing = await prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return error(res, "Ticket not found", 404);
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status },
    });

    return success(res, ticket, "Ticket updated");
  } catch (err) {
    return error(res, "Failed to update ticket", 500);
  }
}

export async function replyTicket(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const message = req.body.message as string;
    const attachmentIds = req.body.attachmentIds as string[] | undefined;

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!ticket) {
      return error(res, "Ticket not found", 404);
    }

    // Fetch sender name separately to avoid Prisma include type inference issues
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: userId,
        senderType: "user",
        message,
      },
    });

    // Link attachments to this message
    if (attachmentIds?.length) {
      await prisma.fileAttachment.updateMany({
        where: { id: { in: attachmentIds }, userId },
        data: { messageId: ticketMessage.id },
      });
    }

    await prisma.supportTicket.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    const attachments = attachmentIds?.length
      ? await prisma.fileAttachment.findMany({ where: { messageId: ticketMessage.id } })
      : [];

    const authorName = sender
      ? `${sender.firstName} ${sender.lastName}`
      : "User";

    // Send admin email notification (async, non-blocking)
    notifyAdminTicketReply(
      sender?.email || "",
      authorName,
      ticket.id,
      ticket.subject,
      message
    ).catch(() => {});

    // Create in-app notification for the user (ticket reply confirmation)
    createInAppNotification(
      userId,
      "support",
      "Reply Sent",
      `Your reply to "${ticket.subject}" has been sent.`
    ).catch(() => {});

    return success(
      res,
      {
        id: ticketMessage.id,
        message: ticketMessage.message,
        isStaff: false,
        authorName,
        createdAt: ticketMessage.createdAt,
        attachments: attachments.map(formatAttachment),
      },
      "Reply sent",
      201
    );
  } catch (err) {
    return error(res, "Failed to send reply", 500);
  }
}

export async function uploadAttachment(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const file = req.file;

    if (!file) {
      return error(res, "No file uploaded");
    }

    const attachment = await prisma.fileAttachment.create({
      data: {
        userId,
        messageId: (req.body.messageId as string) || null,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        url: `/uploads/${file.filename}`,
        context: (req.body.context as string) || "support",
      },
    });

    return success(res, formatAttachment(attachment), "File uploaded", 201);
  } catch (err) {
    return error(res, "Failed to upload file", 500);
  }
}
