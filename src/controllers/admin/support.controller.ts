import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import { createInAppNotification } from "../../services/notification.service.js";
import { emitToTicketRoom, emitToUser } from "../../services/socket.service.js";
import { sendWhatsAppMessage } from "../../services/whatsapp.service.js";

// GET /api/admin/support
export async function listTickets(req: Request, res: Response) {
  try {
    const {
      userId,
      status,
      priority,
      category,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.supportTicket.count({ where }),
    ]);

    const formatted = tickets.map((t: any) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      user: t.user,
      firstMessage: t.messages[0]?.message || "",
      messageCount: t._count.messages,
      whatsappPhone: t.whatsappPhone ?? null,
    }));

    return success(res, { tickets: formatted, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("admin listTickets error:", err);
    return error(res, "Failed to fetch tickets", 500);
  }
}

// GET /api/admin/support/:id
export async function getTicket(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        messages: {
          include: {
            attachments: true,
            sender: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) return error(res, "Ticket not found", 404);

    const [firstMessage, ...replyMessages] = ticket.messages;

    return success(res, {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      user: ticket.user,
      whatsappPhone: (ticket as any).whatsappPhone ?? null,
      message: firstMessage?.message || "",
      replies: replyMessages.map((msg) => ({
        id: msg.id,
        message: msg.message,
        isStaff: msg.senderType === "admin",
        authorName:
          msg.senderType === "admin"
            ? "Support Team"
            : `${msg.sender?.firstName ?? ""} ${msg.sender?.lastName ?? ""}`.trim(),
        createdAt: msg.createdAt,
      })),
    });
  } catch (err) {
    console.error("admin getTicket error:", err);
    return error(res, "Failed to fetch ticket", 500);
  }
}

// POST /api/admin/support/:id/reply
export async function replyTicket(req: Request, res: Response) {
  try {
    const adminId = req.userId!;
    const id = req.params.id as string;
    const message = req.body.message as string;

    if (!message?.trim()) return error(res, "Message is required", 400);

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return error(res, "Ticket not found", 404);

    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: adminId,
        senderType: "admin",
        message: message.trim(),
      },
    });

    // Bump updatedAt and set status to "in_progress" if it was "open"
    await prisma.supportTicket.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        ...(ticket.status === "open" ? { status: "in_progress" } : {}),
      },
    });

    const replyPayload = {
      id: ticketMessage.id,
      message: ticketMessage.message,
      isStaff: true,
      authorName: "Support Team",
      createdAt: ticketMessage.createdAt,
    };

    // Real-time: push reply to everyone viewing this ticket (user + admin)
    emitToTicketRoom(id, "support_new_reply", { ticketId: id, reply: replyPayload });

    // Also bump the ticket list entry for anyone watching
    const newStatus = ticket.status === "open" ? "in_progress" : ticket.status;
    emitToTicketRoom(id, "ticket_status_changed", { ticketId: id, status: newStatus });

    // If ticket came via WhatsApp, send the reply back to the user's WA number
    if (ticket.whatsappJid) {
      sendWhatsAppMessage(ticket.whatsappJid, `Support Team: ${message.trim()}`).catch(() => {});
    }

    // Push notification to the user (even if they're not in the ticket room)
    if (ticket.userId) emitToUser(ticket.userId, "notification", {
      type: "support",
      title: "Support Team Replied",
      message: `Your ticket "${ticket.subject}" has a new reply.`,
      createdAt: new Date().toISOString(),
      isRead: false,
    });
    if (ticket.userId) {
      createInAppNotification(
        ticket.userId,
        "support",
        "Support Team Replied",
        `Your ticket "${ticket.subject}" has a new reply from the support team.`
      ).catch(() => {});
    }

    return success(res, replyPayload, "Reply sent", 201);
  } catch (err) {
    console.error("admin replyTicket error:", err);
    return error(res, "Failed to send reply", 500);
  }
}

// PATCH /api/admin/support/:id/status
export async function updateTicketStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const status = req.body.status as string;

    const allowed = ["open", "in_progress", "resolved", "closed"];
    if (!allowed.includes(status)) {
      return error(res, `Invalid status. Allowed: ${allowed.join(", ")}`, 400);
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return error(res, "Ticket not found", 404);

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });

    const statusLabel: Record<string, string> = {
      open: "Open",
      in_progress: "In Progress",
      resolved: "Resolved",
      closed: "Closed",
    };

    // Real-time: notify everyone in the ticket room of the status change
    emitToTicketRoom(id, "ticket_status_changed", { ticketId: id, status });

    // Push notification to user (not applicable for WA-only tickets)
    if (ticket.userId) {
      emitToUser(ticket.userId, "notification", {
        type: "support",
        title: "Ticket Status Updated",
        message: `Your ticket "${ticket.subject}" is now ${statusLabel[status] ?? status}.`,
        createdAt: new Date().toISOString(),
        isRead: false,
      });
      createInAppNotification(
        ticket.userId,
        "support",
        "Ticket Status Updated",
        `Your ticket "${ticket.subject}" status changed to ${statusLabel[status] ?? status}.`
      ).catch(() => {});
    }

    return success(res, updated, "Status updated");
  } catch (err) {
    console.error("admin updateTicketStatus error:", err);
    return error(res, "Failed to update status", 500);
  }
}
