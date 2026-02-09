import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { error } from "../utils/response.js";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".");
          fieldErrors[key] = issue.message;
        }
        error(res, "Validation failed", 400, fieldErrors);
        return;
      }
      next(err);
    }
  };
}
