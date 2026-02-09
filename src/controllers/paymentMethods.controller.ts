import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

/**
 * Get active payment wallets/methods
 * GET /api/payment-methods
 */
export async function getPaymentMethods(req: Request, res: Response) {
  try {
    const { type } = req.query; // bank or crypto

    const where: Record<string, unknown> = { isActive: true };
    if (type && (type === "bank" || type === "crypto")) {
      where.type = type;
    }

    const paymentMethods = await prisma.paymentWallet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        method: true,
        name: true,
        address: true,
        network: true,
        bankName: true,
        accountName: true,
        swiftCode: true,
        routingNumber: true,
        instructions: true,
        qrCodeData: true,
      },
    });

    return success(res, paymentMethods);
  } catch (err) {
    console.error("getPaymentMethods error:", err);
    return error(res, "Failed to fetch payment methods", 500);
  }
}

/**
 * Get a specific payment method by ID
 * GET /api/payment-methods/:id
 */
export async function getPaymentMethodById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const paymentMethod = await prisma.paymentWallet.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        method: true,
        name: true,
        address: true,
        network: true,
        bankName: true,
        accountName: true,
        swiftCode: true,
        routingNumber: true,
        instructions: true,
        qrCodeData: true,
      },
    });

    if (!paymentMethod) {
      return error(res, "Payment method not found", 404);
    }

    if (!paymentMethod) {
      return error(res, "Payment method is not available", 403);
    }

    return success(res, paymentMethod);
  } catch (err) {
    console.error("getPaymentMethodById error:", err);
    return error(res, "Failed to fetch payment method", 500);
  }
}
