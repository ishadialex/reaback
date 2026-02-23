import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";
import {
  sendBidSubmittedEmailToAdmin,
  sendBidConfirmationEmailToUser,
  sendBuyNowEmailToAdmin,
  sendBuyNowConfirmationEmailToUser,
} from "../services/email.service.js";

export async function submitBid(req: Request, res: Response) {
  try {
    const propertyId = String(req.params.id);
    const userId = (req as any).userId as string;
    const { amount } = req.body;

    const bidAmount = Number(amount);
    if (!bidAmount || bidAmount <= 0) {
      return error(res, "A valid bid amount is required.", 400);
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId, isActive: true },
      select: { id: true, title: true, location: true, category: true, investmentStatus: true },
    });

    if (!property) return error(res, "Property not found.", 404);
    if (property.category !== "for_sale") return error(res, "Bidding is only available for for-sale properties.", 400);
    if (property.investmentStatus !== "available") return error(res, "This property is not currently accepting bids.", 400);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true },
    });

    if (!user) return error(res, "User not found.", 404);

    await prisma.property.update({
      where: { id: propertyId },
      data: { bidCount: { increment: 1 }, recentBidAmount: bidAmount } as any,
    });

    const firstName = user.firstName || user.email.split("@")[0];
    const adminEmail = env.ADMIN_EMAIL;

    if (adminEmail) {
      sendBidSubmittedEmailToAdmin(
        adminEmail,
        { name: firstName, email: user.email },
        { title: property.title, location: property.location },
        bidAmount
      ).catch(() => {});
    }

    sendBidConfirmationEmailToUser(user.email, firstName, property.title, bidAmount).catch(() => {});

    return success(res, { message: "Bid submitted successfully." });
  } catch (err) {
    console.error("submitBid error:", err);
    return error(res, "Failed to submit bid.", 500);
  }
}

export async function submitBuyNow(req: Request, res: Response) {
  try {
    const propertyId = String(req.params.id);
    const userId = (req as any).userId as string;

    const property = await prisma.property.findUnique({
      where: { id: propertyId, isActive: true },
      select: { id: true, title: true, location: true, price: true, category: true, investmentStatus: true },
    });

    if (!property) return error(res, "Property not found.", 404);
    if (property.category !== "for_sale") return error(res, "Direct purchase is only available for for-sale properties.", 400);
    if (property.investmentStatus !== "available") return error(res, "This property is not currently available for purchase.", 400);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true },
    });

    if (!user) return error(res, "User not found.", 404);

    const firstName = user.firstName || user.email.split("@")[0];
    const adminEmail = env.ADMIN_EMAIL;

    if (adminEmail) {
      sendBuyNowEmailToAdmin(
        adminEmail,
        { name: firstName, email: user.email },
        { title: property.title, location: property.location, price: property.price }
      ).catch(() => {});
    }

    sendBuyNowConfirmationEmailToUser(
      user.email,
      firstName,
      { title: property.title, location: property.location, price: property.price }
    ).catch(() => {});

    return success(res, { message: "Purchase request sent successfully." });
  } catch (err) {
    console.error("submitBuyNow error:", err);
    return error(res, "Failed to submit purchase request.", 500);
  }
}
