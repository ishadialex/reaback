

import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { initSocket } from "./services/socket.service.js";
import { startWhatsApp } from "./services/whatsapp.service.js";

const PORT = env.PORT;

async function startServer() {
  try {
    // Test MongoDB connection
    await prisma.$connect();
    console.log("✓ Connected to MongoDB");

    // Create HTTP server from Express app
    const httpServer = createServer(app);

    // Attach Socket.io to the HTTP server
    initSocket(httpServer);

    // Start WhatsApp integration (non-blocking — prints QR in terminal)
    startWhatsApp().catch(console.error);

    // Chat session cleanup — delete sessions inactive for 12+ hours (messages cascade)
    const CHAT_TTL_MS = 12 * 60 * 60 * 1000;
    async function cleanupOldChatSessions() {
      try {
        const cutoff = new Date(Date.now() - CHAT_TTL_MS);
        const { count } = await prisma.chatSession.deleteMany({
          where: { updatedAt: { lt: cutoff } },
        });
        if (count > 0) console.log(`🧹 Deleted ${count} expired chat session(s)`);
      } catch (err) {
        console.error("Chat cleanup error:", err);
      }
    }
    cleanupOldChatSessions(); // run once on startup
    setInterval(cleanupOldChatSessions, 60 * 60 * 1000); // then every hour

    httpServer.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   API base: http://localhost:${PORT}/api`);
      console.log(`   Socket.io: enabled\n`);
    });
  } catch (error) {
    console.error("✗ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n\nShutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\nShutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
