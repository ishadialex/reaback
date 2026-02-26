import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import { cloudinary } from "../../config/cloudinary.js";

/**
 * Bypass Prisma's aggregation pipeline limit for Property updates.
 *
 * Prisma MongoDB generates one pipeline stage per model field when a model uses @updatedAt.
 * The Property model has ~100 fields — exceeding MongoDB Atlas's 50-stage limit.
 * This helper uses a raw $set + $currentDate command which has no pipeline limit.
 */
async function rawPropertySet(id: string, setData: Record<string, unknown>) {
  // Strip any undefined values and keep only JSON-serialisable values
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(setData)) {
    if (v !== undefined) payload[k] = v;
  }

  await (prisma.$runCommandRaw as any)({
    update: "Property",
    updates: [
      {
        q: { _id: { $oid: id } },
        u: { $set: payload, $currentDate: { updatedAt: true } },
      },
    ],
  });

  return prisma.property.findUnique({ where: { id } });
}

/**
 * Validate investmentType and category combination.
 *   pooled     → airbnb_arbitrage | airbnb_mortgage
 *   individual → airbnb_arbitrage | airbnb_mortgage | for_sale
 */
const VALID_CATEGORIES: Record<string, string[]> = {
  pooled:     ["airbnb_arbitrage", "airbnb_mortgage"],
  individual: ["airbnb_arbitrage", "airbnb_mortgage", "for_sale"],
};

function validateInvestmentTypeCategory(investmentType?: string, category?: string): string | null {
  if (!investmentType || !category) return null;
  const allowed = VALID_CATEGORIES[investmentType];
  if (!allowed) return `Invalid investmentType "${investmentType}". Must be pooled or individual.`;
  if (!allowed.includes(category)) {
    return `Category "${category}" is not allowed for investmentType "${investmentType}". Allowed: ${allowed.join(", ")}.`;
  }
  return null;
}

/** Parse form-data text fields into proper types for Prisma */
function parsePropertyBody(body: any) {
  const data: any = {};

  // Helper: parse float, fallback to 0 if missing or NaN
  const toFloat = (val: any): number => { const n = Number(val); return isNaN(n) ? 0 : n; };
  // Helper: parse int, fallback to 0 if missing or NaN
  const toInt = (val: any): number => { const n = parseInt(val, 10); return isNaN(n) ? 0 : n; };
  // Helper: parse optional float (null if not provided)
  const toFloatOpt = (val: any): number | null => { if (val === undefined || val === null || val === "") return null; const n = Number(val); return isNaN(n) ? null : n; };
  // Helper: parse optional int (null if not provided)
  const toIntOpt = (val: any): number | null => { if (val === undefined || val === null || val === "") return null; const n = parseInt(val, 10); return isNaN(n) ? null : n; };
  // Helper: parse JSON array or comma-separated string
  const toArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((s: any) => String(s).trim());
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch { return val.split(",").map((s: string) => s.trim()).filter(Boolean); }
  };

  // ── Core string fields ──
  if (body.title !== undefined) data.title = body.title;
  if (body.subject !== undefined) data.subject = body.subject;
  if (body.location !== undefined) data.location = body.location;
  if (body.description !== undefined) data.description = body.description;
  if (body.type !== undefined) data.type = body.type;
  if (body.category !== undefined) data.category = body.category;
  if (body.investmentType !== undefined) data.investmentType = body.investmentType;
  if (body.investmentStatus !== undefined) data.investmentStatus = body.investmentStatus;
  if (body.riskLevel !== undefined) data.riskLevel = body.riskLevel;
  if (body.managerName !== undefined) data.managerName = body.managerName;
  if (body.managerRole !== undefined) data.managerRole = body.managerRole;
  if (body.managerPhone !== undefined) data.managerPhone = body.managerPhone;

  // ── Core numbers (floats) ──
  if (body.price !== undefined) data.price = toFloat(body.price);
  if (body.minInvestment !== undefined) data.minInvestment = toFloat(body.minInvestment);
  if (body.maxInvestment !== undefined) data.maxInvestment = toFloat(body.maxInvestment);
  if (body.targetAmount !== undefined) data.targetAmount = toFloat(body.targetAmount);
  if (body.currentFunded !== undefined) data.currentFunded = toFloat(body.currentFunded);
  if (body.monthlyReturn !== undefined) data.monthlyReturn = toFloat(body.monthlyReturn);
  // expectedROI is computed — not accepted from body

  // ── Core numbers (ints) ──
  if (body.duration !== undefined) data.duration = toInt(body.duration);
  if (body.bedrooms !== undefined) data.bedrooms = toInt(body.bedrooms);
  if (body.bathrooms !== undefined) data.bathrooms = toInt(body.bathrooms);
  if (body.parking !== undefined) data.parking = toInt(body.parking);
  if (body.sqft !== undefined) data.sqft = toInt(body.sqft);
  if (body.investorCount !== undefined) data.investorCount = toInt(body.investorCount);
  if (body.bidCount !== undefined) data.bidCount = toInt(body.bidCount);
  if (body.recentBidAmount !== undefined) data.recentBidAmount = toFloat(body.recentBidAmount);

  // ── Core booleans ──
  if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured === "true" || body.isFeatured === true;
  if (body.isActive !== undefined) data.isActive = body.isActive === "true" || body.isActive === true;

  // ── Core array ──
  if (body.features !== undefined) data.features = toArray(body.features);

  // ── Map coordinates ──
  if (body.latitude !== undefined) data.latitude = toFloatOpt(body.latitude);
  if (body.longitude !== undefined) data.longitude = toFloatOpt(body.longitude);

  // ── Interior (for_sale) ──
  if (body.fullBathrooms !== undefined) data.fullBathrooms = toIntOpt(body.fullBathrooms);
  if (body.heating !== undefined) data.heating = toArray(body.heating);
  if (body.cooling !== undefined) data.cooling = toArray(body.cooling);
  if (body.appliancesIncluded !== undefined) data.appliancesIncluded = toArray(body.appliancesIncluded);
  if (body.laundry !== undefined) data.laundry = toArray(body.laundry);
  if (body.interiorFeatures !== undefined) data.interiorFeatures = toArray(body.interiorFeatures);
  if (body.flooring !== undefined) data.flooring = toArray(body.flooring);
  if (body.windows !== undefined) data.windows = toArray(body.windows);
  if (body.basement !== undefined) data.basement = body.basement;
  if (body.fireplaceCount !== undefined) data.fireplaceCount = toInt(body.fireplaceCount);
  if (body.fireplaceFeatures !== undefined) data.fireplaceFeatures = toArray(body.fireplaceFeatures);
  if (body.totalStructureArea !== undefined) data.totalStructureArea = body.totalStructureArea;
  if (body.totalLivableArea !== undefined) data.totalLivableArea = body.totalLivableArea;

  // ── Property exterior (for_sale) ──
  if (body.levels !== undefined) data.levels = body.levels;
  if (body.stories !== undefined) data.stories = toInt(body.stories);
  if (body.patioAndPorch !== undefined) data.patioAndPorch = toArray(body.patioAndPorch);
  if (body.exteriorFeatures !== undefined) data.exteriorFeatures = toArray(body.exteriorFeatures);
  if (body.poolFeatures !== undefined) data.poolFeatures = toArray(body.poolFeatures);
  if (body.hasSpa !== undefined) data.hasSpa = body.hasSpa === "true" || body.hasSpa === true;
  if (body.spaFeatures !== undefined) data.spaFeatures = toArray(body.spaFeatures);
  if (body.fencing !== undefined) data.fencing = toArray(body.fencing);

  // ── Lot (for_sale) ──
  if (body.lotFeatures !== undefined) data.lotFeatures = toArray(body.lotFeatures);
  if (body.additionalStructures !== undefined) data.additionalStructures = body.additionalStructures;
  if (body.parcelNumber !== undefined) data.parcelNumber = body.parcelNumber;

  // ── Construction (for_sale) ──
  if (body.homeType !== undefined) data.homeType = body.homeType;
  if (body.propertySubtype !== undefined) data.propertySubtype = body.propertySubtype;
  if (body.constructionMaterials !== undefined) data.constructionMaterials = toArray(body.constructionMaterials);
  if (body.foundation !== undefined) data.foundation = toArray(body.foundation);
  if (body.roof !== undefined) data.roof = toArray(body.roof);
  if (body.yearBuilt !== undefined) data.yearBuilt = toInt(body.yearBuilt);

  // ── Utilities (for_sale) ──
  if (body.sewer !== undefined) data.sewer = toArray(body.sewer);
  if (body.water !== undefined) data.water = toArray(body.water);
  if (body.utilitiesForProperty !== undefined) data.utilitiesForProperty = toArray(body.utilitiesForProperty);

  // ── Community & HOA (for_sale) ──
  if (body.communityFeatures !== undefined) data.communityFeatures = toArray(body.communityFeatures);
  if (body.security !== undefined) data.security = toArray(body.security);
  if (body.subdivision !== undefined) data.subdivision = body.subdivision;
  if (body.hasHOA !== undefined) data.hasHOA = body.hasHOA === "true" || body.hasHOA === true;
  if (body.hoaFee !== undefined) data.hoaFee = body.hoaFee;
  if (body.region !== undefined) data.region = body.region;

  // ── Financial & Listing (for_sale) ──
  if (body.pricePerSqft !== undefined) data.pricePerSqft = body.pricePerSqft;
  if (body.taxAssessedValue !== undefined) data.taxAssessedValue = body.taxAssessedValue;
  if (body.annualTaxAmount !== undefined) data.annualTaxAmount = body.annualTaxAmount;
  if (body.dateOnMarket !== undefined) data.dateOnMarket = body.dateOnMarket;
  if (body.daysOnMarket !== undefined) data.daysOnMarket = toInt(body.daysOnMarket);
  if (body.listingTerms !== undefined) data.listingTerms = toArray(body.listingTerms);

  // ── Market Value (for_sale) ──
  if (body.zestimate !== undefined) data.zestimate = body.zestimate;
  if (body.estimatedSalesRangeLow !== undefined) data.estimatedSalesRangeLow = body.estimatedSalesRangeLow;
  if (body.estimatedSalesRangeHigh !== undefined) data.estimatedSalesRangeHigh = body.estimatedSalesRangeHigh;
  if (body.rentZestimate !== undefined) data.rentZestimate = body.rentZestimate;
  if (body.zestimateChangePercent !== undefined) data.zestimateChangePercent = body.zestimateChangePercent;
  if (body.zestimateChangeYears !== undefined) data.zestimateChangeYears = toInt(body.zestimateChangeYears);
  if (body.priceHistory !== undefined) {
    try { data.priceHistory = typeof body.priceHistory === "string" ? JSON.parse(body.priceHistory) : body.priceHistory; }
    catch { data.priceHistory = []; }
  }

  // ── Climate Risks (for_sale) ──
  if (body.floodZone !== undefined) data.floodZone = body.floodZone;
  if (body.floodZoneDescription !== undefined) data.floodZoneDescription = body.floodZoneDescription;
  if (body.fireRisk !== undefined) data.fireRisk = body.fireRisk;
  if (body.windRisk !== undefined) data.windRisk = body.windRisk;
  if (body.airQualityRisk !== undefined) data.airQualityRisk = body.airQualityRisk;
  if (body.firstStreetUrl !== undefined) data.firstStreetUrl = body.firstStreetUrl;

  // ── Getting Around (for_sale) ──
  if (body.walkScore !== undefined) data.walkScore = toIntOpt(body.walkScore);
  if (body.walkScoreDescription !== undefined) data.walkScoreDescription = body.walkScoreDescription;
  if (body.bikeScore !== undefined) data.bikeScore = toIntOpt(body.bikeScore);
  if (body.bikeScoreDescription !== undefined) data.bikeScoreDescription = body.bikeScoreDescription;
  if (body.transitScore !== undefined) data.transitScore = toIntOpt(body.transitScore);
  if (body.transitScoreDescription !== undefined) data.transitScoreDescription = body.transitScoreDescription;

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

    // Handle file uploads before the empty-check so image-only PATCHes are allowed
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Append new property images to existing ones (don't replace)
    if (files?.images && files.images.length > 0) {
      if (files.images.length > 20) {
        return error(res, "Maximum 20 property images allowed", 400);
      }
      // Cloudinary returns URLs in file.path — merge with current images
      const newUrls = files.images.map((f: Express.Multer.File) => f.path);
      data.images = [...(existing.images ?? []), ...newUrls];
    }

    // If new manager photo uploaded, use it
    if (files?.managerPhoto?.[0]) {
      data.managerPhoto = files.managerPhoto[0].path;
    }

    if (Object.keys(data).length === 0) {
      return error(res, "No fields provided to update", 400);
    }

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

    const property = await rawPropertySet(id, data);

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
    const property = await rawPropertySet(id, { isActive: false });

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

export async function removeImage(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const url = req.body?.url;

    if (!url || typeof url !== "string") {
      return error(res, "Image URL is required", 400);
    }

    const existing = await prisma.property.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Property not found", 404);
    }

    if (!existing.images.includes(url)) {
      return error(res, "Image URL not found on this property", 404);
    }

    // Extract Cloudinary public_id from URL
    // e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/folder/file.jpg
    // public_id = folder/file (no extension)
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex !== -1) {
      const afterUpload = url.slice(uploadIndex + 8); // skip "/upload/"
      const withoutVersion = afterUpload.replace(/^v\d+\//, ""); // strip v<digits>/
      const publicId = withoutVersion.replace(/\.[^/.]+$/, ""); // strip extension
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    const updatedImages = existing.images.filter((img) => img !== url);
    const property = await rawPropertySet(id, { images: updatedImages });

    return success(res, { images: property?.images ?? updatedImages }, "Image removed successfully");
  } catch (err) {
    console.error("Remove image error:", err);
    return error(res, "Failed to remove image", 500);
  }
}
