import { createServer } from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { initSocket } from "./services/socket.service.js";

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
