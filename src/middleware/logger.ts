import morgan from "morgan";
import { Request } from "express";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

// Custom token for user ID from JWT
morgan.token("user-id", (req: Request) => {
  return (req as any).userId || "guest";
});

// Custom token for real IP address (respects X-Forwarded-For from ngrok/proxies)
morgan.token("real-ip", (req: Request) => {
  return req.ip || req.socket.remoteAddress || "unknown";
});

// Get status color based on code
function getStatusColor(status: string): string {
  const code = parseInt(status);
  if (code >= 500) return colors.red;
  if (code >= 400) return colors.yellow;
  if (code >= 300) return colors.cyan;
  if (code >= 200) return colors.green;
  return colors.reset;
}

// Get method color
function getMethodColor(method: string): string {
  const methodColors: Record<string, string> = {
    GET: colors.blue,
    POST: colors.green,
    PUT: colors.yellow,
    PATCH: colors.cyan,
    DELETE: colors.red,
  };
  return methodColors[method] || colors.reset;
}

// Modern format - colorful, structured logs
export const morganDev = morgan(
  (tokens, req, res) => {
    const method = tokens.method(req, res) || "";
    const url = tokens.url(req, res) || "";
    const status = tokens.status(req, res) || "";
    const responseTime = tokens["response-time"](req, res) || "0";
    const contentLength = tokens.res(req, res, "content-length") || "-";
    const userId = tokens["user-id"](req, res) || "guest";
    const realIp = tokens["real-ip"](req, res) || "unknown";

    const methodColor = getMethodColor(method);
    const statusColor = getStatusColor(status);
    const timeColor = parseFloat(responseTime) > 1000 ? colors.red : parseFloat(responseTime) > 500 ? colors.yellow : colors.green;

    // Show IP only if it's not localhost (::1 or 127.0.0.1)
    const isLocalhost = realIp === "::1" || realIp === "127.0.0.1" || realIp.startsWith("::ffff:127.");
    const ipDisplay = isLocalhost ? "" : ` ${colors.blue}🌍 ${realIp}${colors.reset}`;

    // Modern formatted log
    return [
      `${colors.gray}[${new Date().toLocaleTimeString()}]${colors.reset}`,
      `${methodColor}${colors.bright}${method.padEnd(7)}${colors.reset}`,
      `${colors.cyan}${url}${colors.reset}`,
      `${statusColor}${colors.bright}${status}${colors.reset}`,
      `${timeColor}⚡ ${responseTime}ms${colors.reset}`,
      `${colors.gray}📦 ${contentLength}${colors.reset}`,
      `${colors.magenta}👤 ${userId}${colors.reset}`,
      ipDisplay,
    ].join(" ");
  },
  {
    skip: (req) => req.url === "/health", // Skip health check spam
  }
);

// Production format - compact JSON for log aggregation
export const morganProd = morgan(
  (tokens, req, res) => {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      responseTime: tokens["response-time"](req, res),
      contentLength: tokens.res(req, res, "content-length"),
      userId: tokens["user-id"](req, res),
      userAgent: tokens["user-agent"](req, res),
      ip: tokens["remote-addr"](req, res),
    });
  },
  {
    skip: (req) => req.url === "/health",
  }
);

// Choose format based on environment
export const logger =
  process.env.NODE_ENV === "production" ? morganProd : morganDev;