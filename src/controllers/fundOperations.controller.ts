import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { notifyAdminManualDeposit, notifyAdminWithdrawal, notifyAdminPaymentReceipt } from "../services/notification.service.js";

/**
 * Create a deposit request
 * POST /api/fund-operations/deposit
 */
export async function createDeposit(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { method, amount, details } = req.body;

    // Validate method
    if (!["bank", "crypto", "card"].includes(method)) {
      return error(res, "Invalid payment method", 400);
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 100 || numAmount > 10000000) {
      return error(res, "Amount must be between $100 and $10,000,000", 400);
    }

    // Generate unique reference
    const reference = `DEP-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Create fund operation
    const fundOperation = await prisma.fundOperation.create({
      data: {
        userId,
        type: "deposit",
        method,
        amount: numAmount,
        fee: 0,
        status: "pending",
        details: JSON.stringify(details || {}),
        reference,
      },
    });

    // Create in-app notification for user
    await prisma.notification.create({
      data: {
        userId,
        type: "system",
        title: "Deposit Request Submitted",
        message: `Your deposit request of $${numAmount.toLocaleString()} via ${method} has been submitted. Reference: ${reference}`,
      },
    });

    // Notify admin if manual processing is required
    const parsedDetails = details ? JSON.parse(JSON.stringify(details)) : {};
    if (parsedDetails.manualProcessing) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      });
      if (user) {
        const userName = `${user.firstName} ${user.lastName}`;
        notifyAdminManualDeposit(userName, user.email, numAmount, method, reference, parsedDetails).catch(
          (err) => console.error("Admin manual deposit email error:", err)
        );
      }
    }

    console.log(`💰 Deposit request created: ${reference} - $${numAmount} via ${method} for user ${userId}`);

    return success(res, fundOperation, "Deposit request created successfully");
  } catch (err) {
    console.error("createDeposit error:", err);
    return error(res, "Failed to create deposit request", 500);
  }
}

/**
 * Create a withdrawal request
 * POST /api/fund-operations/withdrawal
 */
export async function createWithdrawal(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { method, amount, details } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return error(res, "Invalid withdrawal amount", 400);
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    // Compute dynamic balance from transactions + completed fund operations
    const [transactions, completedFundOps] = await Promise.all([
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
    for (const tx of transactions) {
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

    const reference = `WTH-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const fundOperation = await prisma.fundOperation.create({
      data: {
        userId,
        type: "withdrawal",
        method,
        amount: numAmount,
        fee: 0,
        status: "pending",
        details: JSON.stringify(details || {}),
        reference,
      },
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        userId,
        type: "system",
        title: "Withdrawal Request Submitted",
        message: `Your withdrawal request of $${numAmount.toLocaleString()} via ${method} has been submitted. Reference: ${reference}`,
      },
    });

    // Always notify admin for withdrawals (they must manually process them)
    const parsedDetails = details ? JSON.parse(JSON.stringify(details)) : {};
    const userName = `${user.firstName} ${user.lastName}`;
    notifyAdminWithdrawal(userName, user.email, numAmount, method, reference, parsedDetails).catch(
      (err) => console.error("Admin withdrawal email error:", err)
    );

    console.log(`💸 Withdrawal request created: ${reference} - $${numAmount} via ${method} for user ${userId}`);

    return success(res, fundOperation, "Withdrawal request submitted successfully");
  } catch (err) {
    console.error("createWithdrawal error:", err);
    return error(res, "Failed to submit withdrawal request", 500);
  }
}

/**
 * Upload payment receipt for a deposit
 * POST /api/fund-operations/upload-receipt
 */
export async function uploadReceipt(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { reference } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return error(res, "No file uploaded", 400);
    }

    if (!reference) {
      return error(res, "Reference is required", 400);
    }

    // Find the fund operation
    const fundOp = await prisma.fundOperation.findFirst({
      where: { reference, userId },
    });

    if (!fundOp) {
      return error(res, "Fund operation not found", 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    await notifyAdminPaymentReceipt(
      `${user.firstName} ${user.lastName}`,
      user.email,
      reference,
      fundOp.amount,
      fundOp.method,
      file.buffer,
      file.originalname,
      file.mimetype
    );

    console.log(`🧾 Payment receipt uploaded for ${reference} by user ${userId}`);

    return success(res, null, "Receipt submitted successfully");
  } catch (err) {
    console.error("uploadReceipt error:", err);
    return error(res, "Failed to upload receipt", 500);
  }
}

/**
 * Get user's fund operations
 * GET /api/fund-operations
 */
export async function getFundOperations(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { type, status } = req.query;

    const where: Record<string, unknown> = { userId };
    if (type && (type === "deposit" || type === "withdrawal")) {
      where.type = type;
    }
    if (status && typeof status === "string") {
      where.status = status;
    }

    const operations = await prisma.fundOperation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        method: true,
        amount: true,
        fee: true,
        status: true,
        reference: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return success(res, operations);
  } catch (err) {
    console.error("getFundOperations error:", err);
    return error(res, "Failed to fetch fund operations", 500);
  }
}

/**
 * Get a specific fund operation by ID
 * GET /api/fund-operations/:id
 */
export async function getFundOperationById(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const operation = await prisma.fundOperation.findUnique({
      where: { id },
    });

    if (!operation) {
      return error(res, "Fund operation not found", 404);
    }

    if (operation.userId !== userId) {
      return error(res, "Unauthorized", 403);
    }

    return success(res, operation);
  } catch (err) {
    console.error("getFundOperationById error:", err);
    return error(res, "Failed to fetch fund operation", 500);
  }
}
