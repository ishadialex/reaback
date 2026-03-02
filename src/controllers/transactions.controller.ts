import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";


export async function getBalanceSummary(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const [transactions, pendingFundOps] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: "completed" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: "pending" },
        select: { type: true, amount: true },
      }),
    ]);

    let deposits = 0;
    let txProfits = 0;
    let adminBonuses = 0;
    let referralBonuses = 0;
    let adminReferralCommissions = 0;
    let adminProfitsAdded = 0;
    let adminBalanceAdjustments = 0;
    let transferIn = 0;
    let withdrawals = 0;
    let investedFunds = 0;
    let transferOut = 0;

    for (const tx of transactions) {
      switch (tx.type) {
        case "deposit": deposits += tx.amount; break;
        case "profit": txProfits += tx.amount; break;
        case "admin_bonus": adminBonuses += tx.amount; break;
        case "admin_profits": adminProfitsAdded += tx.amount; break;
        case "admin_referralCommissions": adminReferralCommissions += tx.amount; break;
        case "admin_balance": adminBalanceAdjustments += tx.amount; break;
        case "referral": referralBonuses += tx.amount; break;
        case "transfer_received": transferIn += tx.amount; break;
        case "withdrawal": withdrawals += Math.abs(tx.amount); break;
        case "investment": investedFunds += Math.abs(tx.amount); break;
        case "transfer_sent": transferOut += Math.abs(tx.amount); break;
      }
    }

    // Compute balance from transaction history — this is the only source that is
    // always complete, including admin-credited profits added before the dual-increment fix.
    const balance = deposits
      + txProfits
      + adminProfitsAdded
      + adminBonuses
      + adminReferralCommissions
      + referralBonuses
      + transferIn
      + adminBalanceAdjustments
      - withdrawals
      - investedFunds
      - transferOut;

    const profits = txProfits + adminProfitsAdded;
    const referralCommissions = referralBonuses + adminReferralCommissions;
    const bonus = adminBonuses;

    // Pending amounts from fund operations awaiting admin approval
    const pendingDeposits = pendingFundOps
      .filter((op) => op.type === "deposit")
      .reduce((sum, op) => sum + op.amount, 0);
    const pendingWithdrawals = pendingFundOps
      .filter((op) => op.type === "withdrawal")
      .reduce((sum, op) => sum + op.amount, 0);

    return success(res, {
      balance,
      profits,
      referralCommissions,
      bonus,
      pendingDeposits,
      pendingWithdrawals,
      breakdown: {
        deposits,
        profits: txProfits,
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
