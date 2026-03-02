
import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import { sendAdminReferralCommissionNotification, createInAppNotification } from "../../services/notification.service.js";

export async function getAllUsers(req: Request, res: Response) {
  try {
    const { role, kycStatus, isActive, search, limit = "50", offset = "0" } = req.query;

    const where: any = {};

    if (role) where.role = role;
    if (kycStatus) where.kycStatus = kycStatus;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: "insensitive" } },
        { firstName: { contains: search as string, mode: "insensitive" } },
        { lastName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        twoFactorEnabled: true,
        kycStatus: true,
        balance: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          where: { isActive: true },
          select: { createdAt: true, lastActive: true, device: true, location: true },
          orderBy: { lastActive: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.user.count({ where });

    const mapped = users.map(({ sessions, ...u }) => ({
      ...u,
      lastLoginAt: sessions[0]?.createdAt ?? null,
      lastActiveAt: sessions[0]?.lastActive ?? null,
      lastLoginDevice: sessions[0]?.device ?? null,
      lastLoginLocation: sessions[0]?.location ?? null,
    }));

    return success(res, { users: mapped, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (err) {
    console.error("Get users error:", err);
    return error(res, "Failed to fetch users", 500);
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const [user, referralCommissionsTx, profitsTx, bonusTx] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          nationality: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          profilePhoto: true,
          bio: true,
          occupation: true,
          role: true,
          emailVerified: true,
          twoFactorEnabled: true,
          kycStatus: true,
          balance: true,
          profits: true,
          referralCommissions: true,
          bonus: true,
          referralCode: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          sessions: {
            select: { createdAt: true, lastActive: true, device: true, browser: true, os: true, location: true, ipAddress: true },
            orderBy: { lastActive: "desc" },
            take: 3,
          },
          _count: {
            select: {
              transactions: true,
              investments: true,
              referrals: true,
              sessions: true,
            },
          },
        },
      }),
      // Compute referral commissions from transaction history (source of truth)
      prisma.transaction.aggregate({
        where: { userId: id, status: "completed", type: { in: ["referral", "admin_referralCommissions"] } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: id, status: "completed", type: { in: ["profit", "admin_profits"] } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: id, status: "completed", type: "admin_bonus" },
        _sum: { amount: true },
      }),
    ]);

    if (!user) {
      return error(res, "User not found", 404);
    }

    const { sessions, ...rest } = user as typeof user & { sessions: Array<{ createdAt: Date; lastActive: Date | null; device: string; browser: string; os: string | null; location: string | null; ipAddress: string | null }> };
    return success(res, {
      ...rest,
      // Override stale model fields with transaction-based totals
      referralCommissions: referralCommissionsTx._sum.amount ?? 0,
      profits: profitsTx._sum.amount ?? 0,
      bonus: bonusTx._sum.amount ?? 0,
      lastLoginAt: sessions[0]?.createdAt ?? null,
      lastActiveAt: sessions[0]?.lastActive ?? null,
      lastLoginDevice: sessions[0]?.device ?? null,
      lastLoginBrowser: sessions[0]?.browser ?? null,
      lastLoginOs: sessions[0]?.os ?? null,
      lastLoginLocation: sessions[0]?.location ?? null,
      lastLoginIp: sessions[0]?.ipAddress ?? null,
      recentSessions: sessions.map((s) => ({
        loginAt: s.createdAt,
        lastActive: s.lastActive,
        device: s.device,
        browser: s.browser,
        os: s.os,
        location: s.location,
        ipAddress: s.ipAddress,
      })),
    });
  } catch (err) {
    console.error("Get user error:", err);
    return error(res, "Failed to fetch user", 500);
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return error(res, "User not found", 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return success(res, user, `User role updated to ${role}`);
  } catch (err) {
    console.error("Update user role error:", err);
    return error(res, "Failed to update user role", 500);
  }
}

export async function updateUserStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return error(res, "User not found", 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    return success(res, user, `User ${isActive ? "activated" : "deactivated"}`);
  } catch (err) {
    console.error("Update user status error:", err);
    return error(res, "Failed to update user status", 500);
  }
}

export async function updateUserKyc(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { kycStatus } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return error(res, "User not found", 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { kycStatus },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        kycStatus: true,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: id,
        type: "security",
        title: "KYC Status Updated",
        message: `Your KYC status has been updated to: ${kycStatus}`,
      },
    });

    return success(res, user, `KYC status updated to ${kycStatus}`);
  } catch (err) {
    console.error("Update KYC error:", err);
    return error(res, "Failed to update KYC status", 500);
  }
}

export async function updateUserBalance(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { amount, note, category = "balance" } = req.body;

    const VALID_CATEGORIES = ["balance", "profits", "referralCommissions", "bonus"] as const;
    type BalanceCategory = typeof VALID_CATEGORIES[number];

    if (!VALID_CATEGORIES.includes(category)) {
      return error(res, `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`, 400);
    }

    const CATEGORY_LABELS: Record<BalanceCategory, string> = {
      balance: "Balance",
      profits: "Profits",
      referralCommissions: "Referral Commissions",
      bonus: "Bonus",
    };
    const categoryLabel = CATEGORY_LABELS[category as BalanceCategory];

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      return error(res, "Invalid amount", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return error(res, "User not found", 404);
    }

    const isDeduct = numAmount < 0;
    const absAmount = Math.abs(numAmount);

    // For balance, the model field is always correct.
    // For profits/referralCommissions/bonus, compute from transaction history
    // because model fields may be stale (0) for users created before the schema migration.
    let currentValue: number;
    if (category === "balance") {
      currentValue = existingUser.balance;
    } else {
      const TX_TYPES: Record<string, string[]> = {
        profits: ["profit", "admin_profits"],
        referralCommissions: ["referral", "admin_referralCommissions"],
        bonus: ["admin_bonus"],
      };
      const txSum = await prisma.transaction.aggregate({
        where: { userId: id, status: "completed", type: { in: TX_TYPES[category] } },
        _sum: { amount: true },
      });
      currentValue = txSum._sum.amount ?? 0;
    }

    if (isDeduct && currentValue < absAmount) {
      return error(res, `Deduction exceeds current ${categoryLabel.toLowerCase()} ($${currentValue.toFixed(2)})`, 400);
    }

    // Sequential writes — avoids MongoDB Atlas session issues with $transaction batch form
    // Also increment balance for non-balance categories so the credit reflects in the user's spendable balance
    await prisma.user.update({
      where: { id },
      data: {
        [category]: { increment: numAmount },
        ...(category !== "balance" ? { balance: { increment: numAmount } } : {}),
      } as any,
    });

    await prisma.transaction.create({
      data: {
        userId: id,
        type: `admin_${category}`,
        amount: numAmount,
        status: "completed",
        description: note
          ? note
          : isDeduct
            ? `Admin deducted $${absAmount.toLocaleString()} from ${categoryLabel.toLowerCase()}`
            : `Admin added $${absAmount.toLocaleString()} to ${categoryLabel.toLowerCase()}`,
      },
    });

    await createInAppNotification(
      id,
      "investment",
      isDeduct ? `${categoryLabel} Deducted` : `${categoryLabel} Added`,
      note
        ? note
        : isDeduct
          ? `$${absAmount.toLocaleString()} has been deducted from your ${categoryLabel.toLowerCase()}.`
          : `$${absAmount.toLocaleString()} has been added to your ${categoryLabel.toLowerCase()}.`
    );

    const updated = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true, balance: true, profits: true, referralCommissions: true, bonus: true },
    });

    return success(res, updated, isDeduct ? `${categoryLabel} deducted` : `${categoryLabel} added`);
  } catch (err) {
    console.error("Update balance error:", err);
    return error(res, "Failed to update balance", 500);
  }
}

export async function resetUser(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) return error(res, "User not found", 404);

    const [tx, fo, ref, inv] = await Promise.all([
      prisma.transaction.deleteMany({ where: { userId: id } }),
      prisma.fundOperation.deleteMany({ where: { userId: id } }),
      prisma.referral.deleteMany({
        where: { OR: [{ referrerId: id }, { referredUserId: id }] },
      }),
      prisma.userInvestment.deleteMany({ where: { userId: id } }),
    ]);

    await prisma.user.update({
      where: { id },
      data: { balance: 0, referredById: null },
    });

    return success(res, {
      deleted: {
        transactions: tx.count,
        fundOperations: fo.count,
        referrals: ref.count,
        investments: inv.count,
      },
    }, `User ${user.firstName} ${user.lastName} has been reset`);
  } catch (err) {
    console.error("resetUser error:", err);
    return error(res, "Failed to reset user", 500);
  }
}

export async function assignReferral(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { referrerIdentifier, reward } = req.body;

    if (!referrerIdentifier || typeof referrerIdentifier !== "string") {
      return error(res, "Referrer email or referral code is required", 400);
    }

    const numReward = parseFloat(reward);
    if (isNaN(numReward) || numReward < 0) {
      return error(res, "Reward must be a non-negative number", 400);
    }

    // Find the referred user
    const referredUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true, referredById: true },
    });
    if (!referredUser) return error(res, "User not found", 404);

    // Find the referrer by email OR referral code
    const referrer = await prisma.user.findFirst({
      where: {
        OR: [
          { email: referrerIdentifier.toLowerCase().trim() },
          { referralCode: referrerIdentifier.trim() },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!referrer) return error(res, "Referrer not found — check email or referral code", 404);
    if (referrer.id === id) return error(res, "A user cannot be their own referrer", 400);

    // Remove any existing referral relationship for this referred user
    await prisma.referral.deleteMany({ where: { referredUserId: id } });

    const referredName = `${referredUser.firstName} ${referredUser.lastName}`;
    const referrerName = `${referrer.firstName} ${referrer.lastName}`;

    // Create new referral relationship + optional reward in a single transaction
    // timeout: 15000ms because 8 sequential MongoDB Atlas round-trips exceed the 5s default
    await prisma.$transaction(async (tx) => {
      await tx.referral.create({
        data: {
          referrerId: referrer.id,
          referredUserId: id,
          status: "completed",
          reward: numReward,
        },
      });

      await tx.user.update({
        where: { id },
        data: { referredById: referrer.id },
      });

      if (numReward > 0) {
        // Credit referrer
        await tx.user.update({
          where: { id: referrer.id },
          data: { balance: { increment: numReward } },
        });
        await tx.transaction.create({
          data: {
            userId: referrer.id,
            type: "referral",
            amount: numReward,
            status: "completed",
            description: `Referral commission for ${referredName} (assigned by admin)`,
            reference: id, // referredUserId — used to aggregate per-referral earnings
          },
        });
        await tx.notification.create({
          data: {
            userId: referrer.id,
            type: "transaction",
            title: "Referral Commission Credited",
            message: `$${numReward.toLocaleString()} referral commission has been credited for ${referredName}.`,
          },
        });

        // Credit referred user
        await tx.user.update({
          where: { id },
          data: { balance: { increment: numReward } },
        });
        await tx.transaction.create({
          data: {
            userId: id,
            type: "referral",
            amount: numReward,
            status: "completed",
            description: `Referral commission credited (referred by ${referrerName}, assigned by admin)`,
          },
        });
        await tx.notification.create({
          data: {
            userId: id,
            type: "transaction",
            title: "Referral Commission Credited",
            message: `$${numReward.toLocaleString()} referral commission has been credited to your account.`,
          },
        });
      }
    }, { timeout: 15000 });

    // Send real-time push + email to both users (non-blocking, outside the transaction)
    if (numReward > 0) {
      const referredName = `${referredUser.firstName} ${referredUser.lastName}`;
      const referrerName = `${referrer.firstName} ${referrer.lastName}`;
      sendAdminReferralCommissionNotification(
        referrer.id,
        referrer.email,
        referrerName,
        referredUser.id,
        referredUser.email,
        referredName,
        numReward
      ).catch((err) => console.error("sendAdminReferralCommissionNotification failed:", err));
    }

    return success(res, { referrerId: referrer.id, referredUserId: id, reward: numReward }, "Referral assigned successfully");
  } catch (err) {
    console.error("Assign referral error:", err);
    return error(res, "Failed to assign referral", 500);
  }
}

export async function getUserStats(req: Request, res: Response) {
  try {
    const [totalUsers, activeUsers, verifiedUsers, adminCount, superadminCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { kycStatus: "verified" } }),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.user.count({ where: { role: "superadmin" } }),
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      verifiedUsers,
      adminCount,
      superadminCount,
      regularUsers: totalUsers - adminCount - superadminCount,
    };

    return success(res, stats);
  } catch (err) {
    console.error("Get user stats error:", err);
    return error(res, "Failed to fetch user stats", 500);
  }
}
