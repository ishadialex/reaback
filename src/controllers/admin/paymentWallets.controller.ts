import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

/**
 * GET /api/admin/payment-wallets
 * List all payment wallets (active and inactive)
 */
export async function getAllPaymentWallets(req: Request, res: Response) {
  try {
    const { type } = req.query;

    const where: Record<string, unknown> = {};
    if (type === "bank" || type === "crypto") where.type = type;

    const wallets = await prisma.paymentWallet.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return success(res, wallets);
  } catch (err) {
    console.error("getAllPaymentWallets error:", err);
    return error(res, "Failed to fetch payment wallets", 500);
  }
}

/**
 * POST /api/admin/payment-wallets
 * Create a new payment wallet
 */
export async function createPaymentWallet(req: Request, res: Response) {
  try {
    const {
      type,
      method,
      name,
      address,
      network,
      bankName,
      accountName,
      swiftCode,
      routingNumber,
      instructions,
      qrCodeData,
      isActive,
    } = req.body;

    if (!type || !method || !name) {
      return error(res, "type, method and name are required", 400);
    }

    if (type !== "bank" && type !== "crypto") {
      return error(res, "type must be 'bank' or 'crypto'", 400);
    }

    const wallet = await prisma.paymentWallet.create({
      data: {
        type,
        method,
        name,
        address: address ?? "",
        network: network ?? "",
        bankName: bankName ?? "",
        accountName: accountName ?? "",
        swiftCode: swiftCode ?? "",
        routingNumber: routingNumber ?? "",
        instructions: instructions ?? "",
        qrCodeData: qrCodeData ?? "",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return success(res, wallet, "Payment wallet created", 201);
  } catch (err) {
    console.error("createPaymentWallet error:", err);
    return error(res, "Failed to create payment wallet", 500);
  }
}

/**
 * PATCH /api/admin/payment-wallets/:id
 * Update payment wallet details
 */
export async function updatePaymentWallet(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.paymentWallet.findUnique({ where: { id } });
    if (!existing) return error(res, "Payment wallet not found", 404);

    const {
      type,
      method,
      name,
      address,
      network,
      bankName,
      accountName,
      swiftCode,
      routingNumber,
      instructions,
      qrCodeData,
      isActive,
    } = req.body;

    const data: Record<string, unknown> = {};
    if (type !== undefined) {
      if (type !== "bank" && type !== "crypto") return error(res, "type must be 'bank' or 'crypto'", 400);
      data.type = type;
    }
    if (method !== undefined) data.method = method;
    if (name !== undefined) data.name = name;
    if (address !== undefined) data.address = address;
    if (network !== undefined) data.network = network;
    if (bankName !== undefined) data.bankName = bankName;
    if (accountName !== undefined) data.accountName = accountName;
    if (swiftCode !== undefined) data.swiftCode = swiftCode;
    if (routingNumber !== undefined) data.routingNumber = routingNumber;
    if (instructions !== undefined) data.instructions = instructions;
    if (qrCodeData !== undefined) data.qrCodeData = qrCodeData;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const wallet = await prisma.paymentWallet.update({ where: { id }, data });
    return success(res, wallet, "Payment wallet updated");
  } catch (err) {
    console.error("updatePaymentWallet error:", err);
    return error(res, "Failed to update payment wallet", 500);
  }
}

/**
 * PATCH /api/admin/payment-wallets/:id/toggle
 * Toggle isActive for a payment wallet
 */
export async function togglePaymentWallet(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.paymentWallet.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!existing) return error(res, "Payment wallet not found", 404);

    const wallet = await prisma.paymentWallet.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return success(
      res,
      wallet,
      `Payment wallet ${wallet.isActive ? "activated" : "deactivated"}`
    );
  } catch (err) {
    console.error("togglePaymentWallet error:", err);
    return error(res, "Failed to toggle payment wallet", 500);
  }
}

/**
 * DELETE /api/admin/payment-wallets/:id
 * Delete a payment wallet permanently
 */
export async function deletePaymentWallet(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.paymentWallet.findUnique({ where: { id } });
    if (!existing) return error(res, "Payment wallet not found", 404);

    await prisma.paymentWallet.delete({ where: { id } });
    return success(res, null, "Payment wallet deleted");
  } catch (err) {
    console.error("deletePaymentWallet error:", err);
    return error(res, "Failed to delete payment wallet", 500);
  }
}
