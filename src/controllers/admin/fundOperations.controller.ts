import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import {
  sendFundOperationApprovedEmail,
  sendFundOperationRejectedEmail,
} from "../../services/email.service.js";
import { createInAppNotification } from "../../services/notification.service.js";

export async function getAllFundOperations(req: Request, res: Response) {
  try {
    const { type, status, limit = "50", offset = "0" } = req.query;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [operations, total] = await Promise.all([
      prisma.fundOperation.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.fundOperation.count({ where }),
    ]);

    return success(res, { operations, total });
  } catch (err) {
    console.error("getAllFundOperations error:", err);
    return error(res, "Failed to fetch fund operations", 500);
  }
}

export async function approveFundOperation(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { note } = req.body || {};

    const op = await prisma.fundOperation.findUnique({ where: { id } });
    if (!op) return error(res, "Fund operation not found", 404);
    if (op.status !== "pending") return error(res, "Only pending operations can be approved", 400);

    const isDeposit = op.type === "deposit";

    const userRecord = await prisma.user.findUnique({
      where: { id: op.userId },
      select: { balance: true, email: true, firstName: true },
    });

    if (!isDeposit && (!userRecord || userRecord.balance < op.amount)) {
      return error(res, "User has insufficient balance for this withdrawal", 400);
    }

    const defaultDesc = isDeposit
      ? `Deposit of $${op.amount.toLocaleString()} approved (ref: ${op.reference})`
      : `Withdrawal of $${op.amount.toLocaleString()} approved (ref: ${op.reference})`;

    const defaultMsg = isDeposit
      ? `Your deposit of $${op.amount.toLocaleString()} has been approved and credited to your account.`
      : `Your withdrawal of $${op.amount.toLocaleString()} has been processed.`;

    // Sequential updates — same pattern as updateUserBalance
    await prisma.fundOperation.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
    });

    await prisma.user.update({
      where: { id: op.userId },
      data: { balance: isDeposit ? { increment: op.amount } : { decrement: op.amount } },
    });

    await prisma.transaction.create({
      data: {
        userId: op.userId,
        type: isDeposit ? "deposit" : "withdrawal",
        amount: isDeposit ? op.amount : -op.amount,
        status: "completed",
        description: note || defaultDesc,
        reference: op.reference,
      },
    });

    await createInAppNotification(
      op.userId,
      "investment",
      isDeposit ? "Deposit Approved" : "Withdrawal Approved",
      note || defaultMsg
    );

    // Send email notification (non-blocking)
    if (userRecord?.email && userRecord?.firstName) {
      sendFundOperationApprovedEmail(
        userRecord.email,
        userRecord.firstName,
        op.type as "deposit" | "withdrawal",
        op.amount,
        op.reference
      ).catch((err) => console.error("Failed to send fund operation approved email:", err));
    }

    return success(res, null, `${isDeposit ? "Deposit" : "Withdrawal"} approved`);
  } catch (err) {
    console.error("approveFundOperation error:", err);
    return error(res, "Failed to approve fund operation", 500);
  }
}

export async function rejectFundOperation(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { reason } = req.body || {};

    const op = await prisma.fundOperation.findUnique({ where: { id } });
    if (!op) return error(res, "Fund operation not found", 404);
    if (op.status !== "pending") return error(res, "Only pending operations can be rejected", 400);

    const isDeposit = op.type === "deposit";

    const userRecord = await prisma.user.findUnique({
      where: { id: op.userId },
      select: { email: true, firstName: true },
    });

    const defaultMsg = isDeposit
      ? `Your deposit request of $${op.amount.toLocaleString()} has been rejected.`
      : `Your withdrawal request of $${op.amount.toLocaleString()} has been rejected.`;

    await prisma.fundOperation.update({
      where: { id },
      data: { status: "rejected", completedAt: new Date() },
    });

    await createInAppNotification(
      op.userId,
      "investment",
      isDeposit ? "Deposit Rejected" : "Withdrawal Rejected",
      reason || defaultMsg
    );

    // Send email notification (non-blocking)
    if (userRecord?.email && userRecord?.firstName) {
      sendFundOperationRejectedEmail(
        userRecord.email,
        userRecord.firstName,
        op.type as "deposit" | "withdrawal",
        op.amount,
        reason
      ).catch((err) => console.error("Failed to send fund operation rejected email:", err));
    }

    return success(res, null, `${isDeposit ? "Deposit" : "Withdrawal"} rejected`);
  } catch (err) {
    console.error("rejectFundOperation error:", err);
    return error(res, "Failed to reject fund operation", 500);
  }
}
