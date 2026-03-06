import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Map from userId → set of socket IDs
const userSockets = new Map<string, Set<string>>();

let io: SocketServer | null = null;

export function getIO(): SocketServer | null {
  return io;
}

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1") ||
          origin === env.FRONTEND_URL ||
          origin.includes("ngrok") ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com")
        ) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed`));
      },
      credentials: true,
    },
  });

  // JWT authentication middleware for sockets
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // Register socket for this user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    console.log(`🔌 Socket connected: user ${userId} (socket ${socket.id})`);

    // Support ticket rooms: join/leave so both user and admin get live updates
    socket.on("join_ticket", (ticketId: string) => {
      if (ticketId) socket.join(`ticket:${ticketId}`);
    });

    socket.on("leave_ticket", (ticketId: string) => {
      if (ticketId) socket.leave(`ticket:${ticketId}`);
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
      console.log(`🔌 Socket disconnected: user ${userId} (socket ${socket.id})`);
    });
  });

  // ── /chat namespace — no JWT, used by the public website chat widget ──────
  const chatNs = io.of("/chat");
  chatNs.on("connection", (socket) => {
    const sessionToken = socket.handshake.auth?.sessionToken as string | undefined;
    if (!sessionToken) {
      socket.disconnect();
      return;
    }
    socket.join(`chat:${sessionToken}`);
    console.log(`💬 Chat widget connected: session ${sessionToken.slice(0, 8)}…`);
    socket.on("disconnect", () => {
      console.log(`💬 Chat widget disconnected: session ${sessionToken.slice(0, 8)}…`);
    });
  });

  return io;
}

/**
 * Emit an event to everyone in a ticket room (both user and admin viewing the ticket)
 */
export function emitToTicketRoom(ticketId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event, data);
}

/**
 * Emit a notification event to a specific user across all their connected sockets
 */
export function emitToUser(
  userId: string,
  event: string,
  data: unknown
): void {
  if (!io) return;

  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, data);
  }
}

/**
 * Notify all of a user's connected sockets that their session has been revoked
 * (e.g. force-login from another device). The dashboard listens for this and
 * immediately logs out without waiting for the next token refresh.
 */
export function emitSessionRevoked(userId: string): void {
  emitToUser(userId, "session_revoked", {});
}

/**
 * Broadcast an event to every connected socket (used for admin notifications like new WA tickets)
 */
export function emitToAll(event: string, data: unknown): void {
  if (!io) return;
  io.emit(event, data);
}

/**
 * Push an event directly into a website chat session room (used when admin replies via WhatsApp)
 */
export function emitToChatSession(sessionToken: string, event: string, data: unknown): void {
  if (!io) return;
  io.of("/chat").to(`chat:${sessionToken}`).emit(event, data);
}
