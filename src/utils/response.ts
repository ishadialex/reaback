import { Response } from "express";

export function success(res: Response, data: unknown, message?: string, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    ...(message && { message }),
  });
}

export function error(res: Response, message: string, status = 400, errors?: Record<string, string>) {
  return res.status(status).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
}
