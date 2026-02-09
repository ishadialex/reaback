import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

export async function getAll(req: Request, res: Response) {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
    });
    return success(res, testimonials);
  } catch (err) {
    return error(res, "Failed to fetch testimonials", 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const testimonial = await prisma.testimonial.create({
      data: req.body,
    });
    return success(res, testimonial, "Testimonial created", 201);
  } catch (err) {
    return error(res, "Failed to create testimonial", 500);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Testimonial not found", 404);
    }

    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: req.body,
    });
    return success(res, testimonial, "Testimonial updated");
  } catch (err) {
    return error(res, "Failed to update testimonial", 500);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Testimonial not found", 404);
    }

    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: { isActive: false },
    });
    return success(res, testimonial, "Testimonial deleted");
  } catch (err) {
    return error(res, "Failed to delete testimonial", 500);
  }
}
