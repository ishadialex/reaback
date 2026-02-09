import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function getInfo(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    return success(res, { referralCode: user.referralCode });
  } catch (err) {
    return error(res, "Failed to fetch referral info", 500);
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const referralCount = await prisma.referral.count({
      where: { referrerId: userId },
    });

    const rewardSum = await prisma.referral.aggregate({
      where: { referrerId: userId },
      _sum: { reward: true },
    });

    return success(res, {
      totalReferrals: referralCount,
      totalRewards: rewardSum._sum.reward || 0,
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
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return success(res, referrals);
  } catch (err) {
    return error(res, "Failed to fetch referral list", 500);
  }
}
