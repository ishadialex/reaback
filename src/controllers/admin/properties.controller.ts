import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

/** Parse form-data text fields into proper types for Prisma */
function parsePropertyBody(body: any) {
  const data: any = {};

  // Strings
  if (body.title) data.title = body.title;
  if (body.location) data.location = body.location;
  if (body.description) data.description = body.description;
  if (body.type) data.type = body.type;
  if (body.category) data.category = body.category;
  if (body.investmentType) data.investmentType = body.investmentType;
  if (body.investmentStatus) data.investmentStatus = body.investmentStatus;
  if (body.riskLevel) data.riskLevel = body.riskLevel;

  // Numbers (floats)
  if (body.price) data.price = Number(body.price);
  if (body.minInvestment) data.minInvestment = Number(body.minInvestment);
  if (body.maxInvestment) data.maxInvestment = Number(body.maxInvestment);
  if (body.targetAmount) data.targetAmount = Number(body.targetAmount);
  if (body.currentFunded) data.currentFunded = Number(body.currentFunded);
  if (body.expectedROI) data.expectedROI = Number(body.expectedROI);
  if (body.monthlyReturn) data.monthlyReturn = Number(body.monthlyReturn);

  // Numbers (ints)
  if (body.duration) data.duration = parseInt(body.duration, 10);
  if (body.bedrooms) data.bedrooms = parseInt(body.bedrooms, 10);
  if (body.bathrooms) data.bathrooms = parseInt(body.bathrooms, 10);
  if (body.parking) data.parking = parseInt(body.parking, 10);
  if (body.sqft) data.sqft = parseInt(body.sqft, 10);
  if (body.investorCount) data.investorCount = parseInt(body.investorCount, 10);

  // Booleans
  if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured === "true";
  if (body.isActive !== undefined) data.isActive = body.isActive === "true";

  // Arrays (sent as comma-separated or JSON)
  if (body.features) {
    try {
      data.features = JSON.parse(body.features);
    } catch {
      data.features = body.features.split(",").map((s: string) => s.trim());
    }
  }

  return data;
}

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
      include: {
        userInvestments: {
          where: { status: "active" },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = properties.map((p) => {
      const funded = p.userInvestments.reduce((sum, inv) => sum + inv.amount, 0);
      const { userInvestments, ...rest } = p;
      return { ...rest, currentFunded: funded, investorCount: userInvestments.length };
    });

    return success(res, mapped);
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

    const activeInvestments = property.userInvestments.filter((inv) => inv.status === "active");
    const funded = activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);

    return success(res, {
      ...property,
      currentFunded: funded,
      investorCount: activeInvestments.length,
    });
  } catch (err) {
    return error(res, "Failed to fetch property", 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 4) {
      return error(res, "Minimum 4 images required", 400);
    }
    if (files.length > 20) {
      return error(res, "Maximum 20 images allowed", 400);
    }

    // Cloudinary returns URLs in file.path
    const images = files.map((f) => f.path);
    const data = parsePropertyBody(req.body);

    // Validate required fields
    if (!data.title || !data.location || !data.price || !data.minInvestment ||
        !data.maxInvestment || !data.targetAmount || !data.expectedROI ||
        !data.monthlyReturn || !data.sqft || !data.description) {
      return error(res, "Missing required fields: title, location, price, minInvestment, maxInvestment, targetAmount, expectedROI, monthlyReturn, sqft, description", 400);
    }

    const property = await prisma.property.create({
      data: { ...data, images },
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

    const data = parsePropertyBody(req.body);

    // If new images uploaded, use them; otherwise keep existing
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      if (files.length < 4) {
        return error(res, "Minimum 4 images required", 400);
      }
      if (files.length > 20) {
        return error(res, "Maximum 20 images allowed", 400);
      }
      // Cloudinary returns URLs in file.path
      data.images = files.map((f) => f.path);
    }

    const property = await prisma.property.update({
      where: { id },
      data,
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
