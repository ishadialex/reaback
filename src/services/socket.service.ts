import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Map from userId → set of socket IDs
const userSockets = new Map<string, Set<string>>();

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1") ||
          origin === env.FRONTEND_URL ||
          origin.includes("ngrok")
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

  return io;
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
