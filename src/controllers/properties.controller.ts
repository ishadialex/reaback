import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

const investmentInclude = {
  userInvestments: {
    where: { status: "active" },
    select: { amount: true },
  },
};

export async function getProperties(req: Request, res: Response) {
  try {
    const { type, location, category, investmentType, status, search } = req.query;

    const where: Record<string, unknown> = { isActive: true };

    if (type && typeof type === "string") {
      where.type = type;
    }

    if (location && typeof location === "string") {
      where.location = { contains: location, mode: "insensitive" };
    }

    if (category && typeof category === "string") {
      where.category = category;
    }

    if (investmentType && typeof investmentType === "string") {
      where.investmentType = investmentType;
    }

    if (status && typeof status === "string") {
      where.investmentStatus = status;
    }

    if (search && typeof search === "string") {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const properties = await prisma.property.findMany({
      where,
      include: investmentInclude,
      orderBy: { createdAt: "desc" },
    });

    return success(res, properties.map(mapProperty));
  } catch (err) {
    return error(res, "Failed to fetch properties", 500);
  }
}

export async function getProperty(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const property = await prisma.property.findUnique({
      where: { id, isActive: true },
      include: investmentInclude,
    });

    if (!property) {
      return error(res, "Property not found", 404);
    }

    return success(res, mapProperty(property));
  } catch (err) {
    return error(res, "Failed to fetch property", 500);
  }
}

export async function getFeatured(req: Request, res: Response) {
  try {
    const properties = await prisma.property.findMany({
      where: { isActive: true, isFeatured: true },
      include: investmentInclude,
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    return success(res, properties.map(mapProperty));
  } catch (err) {
    return error(res, "Failed to fetch featured properties", 500);
  }
}

// Maps DB property to frontend InvestmentProperty shape
function mapProperty(p: any) {
  const activeInvestments = p.userInvestments || [];
  const currentFunded = activeInvestments.reduce((sum: number, inv: any) => sum + inv.amount, 0);
  const investorCount = activeInvestments.length;
  const status = currentFunded >= p.targetAmount && p.targetAmount > 0
    ? "fully-funded"
    : (p.investmentStatus || "available");

  return {
    id: p.id,
    title: p.title,
    subject: p.subject || "",
    description: p.description,
    images: p.images?.length ? p.images : [],
    location: p.location,
    investmentType: p.investmentType || "individual",
    category: p.category || "arbitrage",
    price: p.price,
    minInvestment: p.minInvestment,
    maxInvestment: p.maxInvestment,
    targetAmount: p.targetAmount,
    currentFunded,
    investorCount,
    expectedROI: Math.round(p.monthlyReturn * p.duration * 100) / 100,
    annualReturn: Math.round(p.monthlyReturn * 12 * 100) / 100,
    monthlyReturn: p.monthlyReturn,
    duration: p.duration,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    parking: p.parking,
    area: `${p.sqft} sqft`,
    status,
    features: p.features || [],
    riskLevel: p.riskLevel || "low",
    createdAt: p.createdAt,
    managerName: p.managerName || "",
    managerRole: p.managerRole || "",
    managerPhone: p.managerPhone || "",
    managerPhoto: p.managerPhoto || null,
  };
}
