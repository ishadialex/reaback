import { Request } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
