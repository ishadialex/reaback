import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

export async function getAll(req: Request, res: Response) {
  try {
    const investments = await prisma.investmentOption.findMany({
      orderBy: { order: "asc" },
    });
    return success(res, investments);
  } catch (err) {
    return error(res, "Failed to fetch investment options", 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const investment = await prisma.investmentOption.create({
      data: req.body,
    });
    return success(res, investment, "Investment option created", 201);
  } catch (err) {
    return error(res, "Failed to create investment option", 500);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.investmentOption.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Investment option not found", 404);
    }

    const investment = await prisma.investmentOption.update({
      where: { id },
      data: req.body,
    });
    return success(res, investment, "Investment option updated");
  } catch (err) {
    return error(res, "Failed to update investment option", 500);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.investmentOption.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Investment option not found", 404);
    }

    const investment = await prisma.investmentOption.update({
      where: { id },
      data: { isActive: false },
    });
    return success(res, investment, "Investment option deleted");
  } catch (err) {
    return error(res, "Failed to delete investment option", 500);
  }
}
