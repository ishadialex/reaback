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
    const [totalCount, completedCount, pendingCount, totalRewards, completedRewards] = await Promise.all([
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

    return success(res, {
      totalReferrals: totalCount,
      completedReferrals: completedCount,
      pendingReferrals: pendingCount,
      totalEarnings: totalRewards._sum.reward || 0,
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

    // Format the response
    const formattedReferrals = referrals.map((ref) => ({
      id: ref.id,
      name: `${ref.referredUser.firstName} ${ref.referredUser.lastName}`,
      email: ref.referredUser.email,
      status: ref.status,
      reward: ref.reward,
      joinedAt: ref.createdAt,
    }));

    return success(res, formattedReferrals);
  } catch (err) {
    return error(res, "Failed to fetch referral list", 500);
  }
}
