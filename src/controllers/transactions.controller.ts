import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";


export async function getBalanceSummary(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const [transactions, pendingFundOps, completedFundOps] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: "completed" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: "pending" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: { in: ["completed", "approved"] } },
        select: { type: true, amount: true },
      }),
    ]);

    let deposits = 0;
    let profits = 0;
    let adminBonuses = 0;
    let referralBonuses = 0;
    let transferIn = 0;
    let withdrawals = 0;
    let investedFunds = 0;
    let transferOut = 0;

    for (const tx of transactions) {
      switch (tx.type) {
        case "deposit": deposits += tx.amount; break;
        case "profit": profits += tx.amount; break;
        case "admin_bonus": adminBonuses += tx.amount; break;
        case "referral": referralBonuses += tx.amount; break;
        case "transfer_received": transferIn += tx.amount; break;
        case "withdrawal": withdrawals += Math.abs(tx.amount); break;
        case "investment": investedFunds += Math.abs(tx.amount); break;
        case "transfer_sent": transferOut += Math.abs(tx.amount); break;
      }
    }

    // Include completed/approved fund operations in balance
    for (const op of completedFundOps) {
      if (op.type === "deposit") deposits += op.amount;
      else if (op.type === "withdrawal") withdrawals += op.amount;
    }

    // balance = (deposits + profits + admin bonuses + referral bonuses + transfers in)
    //         - (withdrawals + invested funds + transfers out)
    const balance = (deposits + profits + adminBonuses + referralBonuses + transferIn)
      - (withdrawals + investedFunds + transferOut);

    // Pending amounts from fund operations awaiting admin approval
    const pendingDeposits = pendingFundOps
      .filter((op) => op.type === "deposit")
      .reduce((sum, op) => sum + op.amount, 0);
    const pendingWithdrawals = pendingFundOps
      .filter((op) => op.type === "withdrawal")
      .reduce((sum, op) => sum + op.amount, 0);

    return success(res, {
      balance,
      pendingDeposits,
      pendingWithdrawals,
      breakdown: {
        deposits,
        profits,
        adminBonuses,
        referralBonuses,
        transferIn,
        withdrawals,
        investedFunds,
        transferOut,
      },
    });
  } catch (err) {
    return error(res, "Failed to compute balance", 500);
  }
}

export async function getTransactions(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { type, limit } = req.query;

    const where: Record<string, unknown> = { userId };

    if (type && typeof type === "string") {
      where.type = type;
    }

    const take = limit ? Math.min(parseInt(limit as string, 10), 100) : 50;

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });

    return success(res, transactions);
  } catch (err) {
    return error(res, "Failed to fetch transactions", 500);
  }
}

export async function getTransaction(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    const transaction = await prisma.transaction.findUnique({
      where: { id, userId },
    });

    if (!transaction) {
      return error(res, "Transaction not found", 404);
    }

    return success(res, transaction);
  } catch (err) {
    return error(res, "Failed to fetch transaction", 500);
  }
}
