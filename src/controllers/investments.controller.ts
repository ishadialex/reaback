import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function getUserInvestments(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const investments = await prisma.userInvestment.findMany({
      where: { userId },
      include: {
        investmentOption: {
          select: { title: true, image: true, minInvestment: true },
        },
        property: {
          select: { title: true, images: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Normalize to consistent shape
    const normalized = investments.map((inv) => {
      const isProperty = !!inv.propertyId;
      return {
        id: inv.id,
        propertyId: inv.propertyId || inv.investmentOptionId,
        propertyTitle: isProperty ? inv.property?.title : inv.investmentOption?.title,
        propertyImage: isProperty
          ? (inv.property?.images?.[0] || "")
          : (inv.investmentOption?.image || ""),
        amount: inv.amount,
        investmentDate: inv.createdAt,
        status: inv.status,
        investmentType: isProperty ? "individual" : "option",
        expectedReturn: Math.round(inv.amount * (inv.expectedROI / 100) * 100) / 100,
        monthlyReturn: Math.round(inv.amount * (inv.monthlyReturn / 100) * 100) / 100,
      };
    });

    return success(res, normalized);
  } catch (err) {
    return error(res, "Failed to fetch investments", 500);
  }
}

export async function createInvestment(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { investmentOptionId, amount } = req.body;

    const option = await prisma.investmentOption.findUnique({
      where: { id: investmentOptionId },
    });

    if (!option) {
      return error(res, "Investment option not found", 404);
    }

    if (!option.isActive) {
      return error(res, "Investment option is no longer available");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    if (user.balance < amount) {
      return error(res, "Insufficient balance");
    }

    const [investment] = await prisma.$transaction([
      prisma.userInvestment.create({
        data: { userId, investmentOptionId, amount, status: "active" },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: "investment",
          amount: -amount,
          status: "completed",
          description: `Investment in ${option.title}`,
          reference: investmentOptionId,
        },
      }),
    ]);

    return success(res, investment, "Investment created", 201);
  } catch (err) {
    return error(res, "Failed to create investment", 500);
  }
}

export async function createPropertyInvestment(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { propertyId, amount } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return error(res, "Invalid investment amount", 400);
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId, isActive: true },
    });

    if (!property) {
      return error(res, "Property not found", 404);
    }

    if (property.investmentStatus !== "available") {
      return error(res, "Property is not available for investment", 400);
    }

    if (numAmount < property.minInvestment) {
      return error(res, `Minimum investment is $${property.minInvestment}`, 400);
    }

    if (numAmount > property.maxInvestment) {
      return error(res, `Maximum investment is $${property.maxInvestment}`, 400);
    }

    if (property.investmentType === "pooled") {
      const remaining = property.targetAmount - property.currentFunded;
      if (numAmount > remaining) {
        return error(res, `Only $${remaining} remaining in this pool`, 400);
      }
    }

    // Compute dynamic balance
    const [txList, completedFundOps] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: "completed" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: { in: ["completed", "approved"] } },
        select: { type: true, amount: true },
      }),
    ]);

    let balance = 0;
    for (const tx of txList) {
      switch (tx.type) {
        case "deposit": case "profit": case "admin_bonus": case "referral": case "transfer_received":
          balance += tx.amount; break;
        case "withdrawal": case "investment": case "transfer_sent":
          balance -= Math.abs(tx.amount); break;
      }
    }
    for (const op of completedFundOps) {
      if (op.type === "deposit") balance += op.amount;
      else if (op.type === "withdrawal") balance -= op.amount;
    }

    if (balance < numAmount) {
      return error(res, "Insufficient balance", 400);
    }

    const newFunded = property.currentFunded + numAmount;
    const newStatus = newFunded >= property.targetAmount ? "fully-funded" : property.investmentStatus;

    const investment = await prisma.$transaction(async (tx) => {
      const inv = await tx.userInvestment.create({
        data: {
          userId,
          propertyId,
          amount: numAmount,
          expectedROI: property.expectedROI,
          monthlyReturn: property.monthlyReturn,
          status: "active",
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "investment",
          amount: -numAmount,
          status: "completed",
          description: `Property investment: ${property.title}`,
          reference: propertyId,
        },
      });

      await tx.property.update({
        where: { id: propertyId },
        data: {
          currentFunded: { increment: numAmount },
          investorCount: { increment: 1 },
          investmentStatus: newStatus,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          type: "investment",
          title: "Investment Confirmed",
          message: `Your investment of $${numAmount.toLocaleString()} in "${property.title}" has been confirmed.`,
        },
      });

      return inv;
    });

    return success(res, { id: investment.id }, "Investment successful", 201);
  } catch (err) {
    console.error("createPropertyInvestment error:", err);
    return error(res, "Failed to create investment", 500);
  }
}
