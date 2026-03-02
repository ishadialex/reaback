import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import {
  sendFundOperationApprovedEmail,
  sendFundOperationRejectedEmail,
  sendReferralCommissionEmail,
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

    const validOperations = operations.filter((op) => op.user !== null);

    return success(res, { operations: validOperations, total });
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

    // Referral commission: 5% to referrer on referred user's FIRST completed deposit (non-blocking)
    if (isDeposit) {
      processReferralCommission(op.userId, op.amount, id).catch((e: unknown) =>
        console.error("Referral commission processing error:", e)
      );
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

async function processReferralCommission(userId: string, depositAmount: number, fundOpId: string) {
  // Only trigger on the user's FIRST completed deposit
  const previousDeposits = await prisma.fundOperation.count({
    where: {
      userId,
      type: "deposit",
      status: "completed",
      id: { not: fundOpId },
    },
  });

  if (previousDeposits > 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, firstName: true, lastName: true },
  });

  if (!user?.referredById) return;

  const referrer = await prisma.user.findUnique({
    where: { id: user.referredById },
    select: { id: true, email: true, firstName: true },
  });

  if (!referrer) return;

  const commission = depositAmount * 0.05;
  const referredName = `${user.firstName} ${user.lastName}`;
  const commissionStr = commission.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  await prisma.user.update({
    where: { id: referrer.id },
    data: { balance: { increment: commission } },
  });

  await prisma.transaction.create({
    data: {
      userId: referrer.id,
      type: "referral",
      amount: commission,
      status: "completed",
      description: `5% referral commission from ${referredName}'s first deposit`,
    },
  });

  await createInAppNotification(
    referrer.id,
    "investment",
    "Referral Commission Earned",
    `You earned $${commissionStr} referral commission from ${referredName}'s first deposit.`
  );

  if (referrer.email && referrer.firstName) {
    sendReferralCommissionEmail(
      referrer.email,
      referrer.firstName,
      referredName,
      commission,
      depositAmount
    ).catch((e: unknown) => console.error("Failed to send referral commission email:", e));
  }
}
