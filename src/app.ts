import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";
import routes from "./routes/index.js";

const app = express();

// Trust exactly one proxy hop (Render's load balancer).
// Using `true` is too permissive — it lets anyone spoof X-Forwarded-For.
// `1` means: trust only the first upstream proxy, which is safe and correct.
app.set("trust proxy", 1);

// Request logging (Morgan)
app.use(logger);

// CORS - Allow localhost + ngrok URLs
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Allow any localhost origin (with any port) for development
      if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
        return callback(null, true);
      }

      // Allow configured frontend URL
      if (origin === env.FRONTEND_URL) return callback(null, true);

      // Allow Vercel deployments (production + preview branches)
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      
// // Allow specific frontend deployments
// if (origin === "https://reafront-sage.vercel.app") return callback(null, true);

      // Allow any ngrok URL for development
      if (origin.includes("ngrok-free.app") || origin.includes("ngrok.io") || origin.includes("ngrok-free.dev")) {
        return callback(null, true);
      }

      // Block all other origins
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Static files (uploaded images)
app.use("/uploads", express.static("uploads"));

// PDF documents are served securely through /api/pdf/serve/:filename
// Direct access via /pdfs/ is disabled for security

// API routes
app.use("/api", routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use(errorHandler);

export default app;
