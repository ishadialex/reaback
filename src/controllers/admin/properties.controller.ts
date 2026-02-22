import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

/**
 * Validate investmentType and category combination
 * All categories are allowed for both individual and pooled investment types
 */
function validateInvestmentTypeCategory(_investmentType?: string, _category?: string): string | null {
  return null;
}

/** Parse form-data text fields into proper types for Prisma */
function parsePropertyBody(body: any) {
  const data: any = {};

  // Strings
  if (body.title) data.title = body.title;
  if (body.subject) data.subject = body.subject;
  if (body.location) data.location = body.location;
  if (body.description) data.description = body.description;
  if (body.type) data.type = body.type;
  if (body.category) data.category = body.category;
  if (body.investmentType) data.investmentType = body.investmentType;
  if (body.investmentStatus) data.investmentStatus = body.investmentStatus;
  if (body.riskLevel) data.riskLevel = body.riskLevel;
  if (body.managerName) data.managerName = body.managerName;
  if (body.managerRole) data.managerRole = body.managerRole;
  if (body.managerPhone) data.managerPhone = body.managerPhone;

  // Helper: parse float, fallback to 0 if missing or NaN
  const toFloat = (val: any): number => { const n = Number(val); return isNaN(n) ? 0 : n; };
  // Helper: parse int, fallback to 0 if missing or NaN
  const toInt = (val: any): number => { const n = parseInt(val, 10); return isNaN(n) ? 0 : n; };

  // Numbers (floats) — always set so Prisma never gets undefined/NaN
  data.price = toFloat(body.price);
  data.minInvestment = toFloat(body.minInvestment);
  data.maxInvestment = toFloat(body.maxInvestment);
  data.targetAmount = toFloat(body.targetAmount);
  if (body.currentFunded !== undefined) data.currentFunded = toFloat(body.currentFunded);
  // expectedROI is computed — not accepted from body
  if (body.monthlyReturn !== undefined) data.monthlyReturn = toFloat(body.monthlyReturn);

  // Numbers (ints)
  if (body.duration !== undefined) data.duration = toInt(body.duration);
  if (body.bedrooms !== undefined) data.bedrooms = toInt(body.bedrooms);
  if (body.bathrooms !== undefined) data.bathrooms = toInt(body.bathrooms);
  if (body.parking !== undefined) data.parking = toInt(body.parking);
  if (body.sqft !== undefined) data.sqft = toInt(body.sqft);
  if (body.investorCount !== undefined) data.investorCount = toInt(body.investorCount);

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
      const funded = p.currentFunded ?? p.userInvestments.reduce((sum, inv) => sum + inv.amount, 0);
      const { userInvestments, ...rest } = p;
      return { ...rest, currentFunded: funded, investorCount: p.investorCount ?? userInvestments.length };
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
    const funded = property.currentFunded ?? activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);

    return success(res, {
      ...property,
      currentFunded: funded,
      investorCount: property.investorCount ?? activeInvestments.length,
    });
  } catch (err) {
    return error(res, "Failed to fetch property", 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Extract property images
    const propertyImages = files?.images || [];
    if (propertyImages.length > 20) {
      return error(res, "Maximum 20 property images allowed", 400);
    }

    // Cloudinary returns URLs in file.path
    const images = propertyImages.map((f) => f.path);

    // Extract manager photo if provided
    const managerPhotoFile = files?.managerPhoto?.[0];
    const managerPhoto = managerPhotoFile ? managerPhotoFile.path : null;

    const data = parsePropertyBody(req.body);

    // Add manager photo to data if provided
    if (managerPhoto) {
      data.managerPhoto = managerPhoto;
    }

    // Auto-compute expectedROI = monthlyReturn * duration
    data.expectedROI = (data.monthlyReturn ?? 0) * (data.duration ?? 12);

    // Only title and location are strictly required (all other fields have DB defaults)
    if (!data.title || !data.location) {
      return error(res, "Missing required fields: title, location", 400);
    }

    // Validate investmentType and category combination
    const validationError = validateInvestmentTypeCategory(data.investmentType, data.category);
    if (validationError) {
      return error(res, validationError, 400);
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

    // Auto-compute expectedROI from monthlyReturn * duration (use existing values as fallback)
    if (data.monthlyReturn !== undefined || data.duration !== undefined) {
      const monthlyReturn = data.monthlyReturn ?? existing.monthlyReturn;
      const duration = data.duration ?? existing.duration;
      data.expectedROI = monthlyReturn * duration;
    }

    // Validate investmentType and category combination if either is being updated
    const investmentType = data.investmentType || existing.investmentType;
    const category = data.category || existing.category;
    const validationError = validateInvestmentTypeCategory(investmentType, category);
    if (validationError) {
      return error(res, validationError, 400);
    }

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // If new property images uploaded, use them; otherwise keep existing
    if (files?.images && files.images.length > 0) {
      if (files.images.length > 20) {
        return error(res, "Maximum 20 property images allowed", 400);
      }
      // Cloudinary returns URLs in file.path
      data.images = files.images.map((f) => f.path);
    }

    // If new manager photo uploaded, use it
    if (files?.managerPhoto?.[0]) {
      data.managerPhoto = files.managerPhoto[0].path;
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
