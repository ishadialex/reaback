import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";

export async function getInfo(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, email: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    // Generate referral link
    const appUrl = env.APP_URL || "http://localhost:3000";
    const referralLink = `${appUrl}/signup?ref=${user.referralCode}`;

    return success(res, {
      referralCode: user.referralCode,
      referralLink,
    });
  } catch (err) {
    return error(res, "Failed to fetch referral info", 500);
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    // Get total referrals and earnings
    const [adminTxSum, totalCount, completedCount, pendingCount, totalRewards, completedRewards] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, status: "completed", type: { in: ["referral", "admin_referralCommissions"] } },
        _sum: { amount: true },
      }),
      prisma.referral.count({
        where: { referrerId: userId },
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: "completed" },
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: "pending" },
      }),
      prisma.referral.aggregate({
        where: { referrerId: userId },
        _sum: { reward: true },
      }),
      prisma.referral.aggregate({
        where: { referrerId: userId, status: "completed" },
        _sum: { reward: true },
      }),
    ]);

    // Get recent referrals for activity chart
    const recentReferrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        createdAt: true,
        reward: true,
        status: true,
      },
    });

    // Compute from transaction history (covers old records before model field fix)
    const totalCommissions = adminTxSum._sum.amount ?? 0;

    return success(res, {
      totalReferrals: totalCount,
      completedReferrals: completedCount,
      pendingReferrals: pendingCount,
      totalEarnings: totalCommissions,
      completedEarnings: completedRewards._sum.reward || 0,
      pendingEarnings: (totalRewards._sum.reward || 0) - (completedRewards._sum.reward || 0),
      recentActivity: recentReferrals,
    });
  } catch (err) {
    return error(res, "Failed to fetch referral stats", 500);
  }
}

export async function getList(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referredUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Sum all referral commission transactions for this referrer keyed by the
    // referenced referredUserId. New transactions store referredUserId in the
    // `reference` field; older records fall back to ref.reward from the model.
    const referredUserIds = referrals.map((r) => r.referredUserId).filter(Boolean) as string[];
    const commissionTxs = referredUserIds.length
      ? await prisma.transaction.findMany({
          where: {
            userId,
            type: "referral",
            status: "completed",
            reference: { in: referredUserIds },
          },
          select: { reference: true, amount: true },
        })
      : [];

    const commissionMap = new Map<string, number>();
    for (const tx of commissionTxs) {
      if (tx.reference) {
        commissionMap.set(tx.reference, (commissionMap.get(tx.reference) ?? 0) + tx.amount);
      }
    }

    // Format the response
    const formattedReferrals = referrals.map((ref) => ({
      id: ref.id,
      name: `${ref.referredUser?.firstName} ${ref.referredUser?.lastName}`,
      email: ref.referredUser?.email ?? "",
      status: ref.status,
      // Use transaction sum when available; fall back to the stored reward field for older records
      reward: commissionMap.has(ref.referredUserId)
        ? commissionMap.get(ref.referredUserId)!
        : ref.reward,
      joinedAt: ref.createdAt,
    }));

    return success(res, formattedReferrals);
  } catch (err) {
    return error(res, "Failed to fetch referral list", 500);
  }
}
