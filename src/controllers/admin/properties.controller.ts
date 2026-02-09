import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

export async function getAll(req: Request, res: Response) {
  try {
    const {
      category,
      investmentType,
      status,
      type,
      featured,
      active
    } = req.query;

    const where: any = {};

    if (category) where.category = category;
    if (investmentType) where.investmentType = investmentType;
    if (status) where.investmentStatus = status;
    if (type) where.type = type;
    if (featured !== undefined) where.isFeatured = featured === "true";
    if (active !== undefined) where.isActive = active === "true";

    const properties = await prisma.property.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return success(res, properties);
  } catch (err) {
    return error(res, "Failed to fetch properties", 500);
  }
}

export async function getOne(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        userInvestments: {
          select: {
            id: true,
            userId: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!property) {
      return error(res, "Property not found", 404);
    }

    return success(res, property);
  } catch (err) {
    return error(res, "Failed to fetch property", 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const property = await prisma.property.create({
      data: req.body,
    });

    return success(res, property, "Property created successfully", 201);
  } catch (err) {
    console.error("Create property error:", err);
    return error(res, "Failed to create property", 500);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Property not found", 404);
    }

    const property = await prisma.property.update({
      where: { id },
      data: req.body,
    });

    return success(res, property, "Property updated successfully");
  } catch (err) {
    console.error("Update property error:", err);
    return error(res, "Failed to update property", 500);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Property not found", 404);
    }

    // Soft delete by setting isActive to false
    const property = await prisma.property.update({
      where: { id },
      data: { isActive: false },
    });

    return success(res, property, "Property deleted successfully");
  } catch (err) {
    console.error("Delete property error:", err);
    return error(res, "Failed to delete property", 500);
  }
}

export async function hardDelete(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.property.findUnique({
      where: { id },
      include: { userInvestments: true },
    });

    if (!existing) {
      return error(res, "Property not found", 404);
    }

    // Check if there are any investments
    if (existing.userInvestments.length > 0) {
      return error(
        res,
        "Cannot delete property with existing investments. Use soft delete instead.",
        400
      );
    }

    await prisma.property.delete({ where: { id } });

    return success(res, null, "Property permanently deleted");
  } catch (err) {
    console.error("Hard delete property error:", err);
    return error(res, "Failed to permanently delete property", 500);
  }
}
