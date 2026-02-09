import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { error } from "../utils/response.js";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    error(res, "Authorization header is required", 401);
    return;
  }

  const providedKey = header.slice(7);
  const expectedKey = env.ADMIN_API_KEY;

  // Timing-safe comparison
  const providedBuf = Buffer.from(providedKey, "utf-8");
  const expectedBuf = Buffer.from(expectedKey, "utf-8");

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    error(res, "Invalid API key", 403);
    return;
  }

  next();
}
