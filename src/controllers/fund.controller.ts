import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function deposit(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { method, amount, details } = req.body;

    // Generate unique reference number
    const reference = `DEP-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Create pending deposit request (requires admin approval)
    const operation = await prisma.fundOperation.create({
      data: {
        userId,
        type: "deposit",
        method,
        amount,
        status: "pending",
        details: JSON.stringify(details || {}),
        reference,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: "system",
        title: "Deposit Request Submitted",
        message: `Your deposit request of $${amount.toLocaleString()} via ${method} has been submitted. Reference: ${reference}`,
      },
    });

    console.log(`💰 Deposit request created: ${reference} - $${amount} via ${method} for user ${userId}`);

    return success(res, operation, "Deposit request submitted successfully", 201);
  } catch (err) {
    console.error("deposit error:", err);
    return error(res, "Failed to process deposit", 500);
  }
}

export async function withdraw(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { method, amount, details } = req.body;

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

    const [operation] = await prisma.$transaction([
      prisma.fundOperation.create({
        data: {
          userId,
          type: "withdrawal",
          method,
          amount,
          status: "completed",
          details: JSON.stringify(details || {}),
          completedAt: new Date(),
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: "withdrawal",
          amount: -amount,
          status: "completed",
          description: `Withdrawal via ${method}`,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      }),
    ]);

    return success(res, operation, "Withdrawal successful", 201);
  } catch (err) {
    return error(res, "Failed to process withdrawal", 500);
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const operations = await prisma.fundOperation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return success(res, operations);
  } catch (err) {
    return error(res, "Failed to fetch fund history", 500);
  }
}
