import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

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
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.user.count({ where });

    return success(res, { users, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (err) {
    console.error("Get users error:", err);
    return error(res, "Failed to fetch users", 500);
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
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
        referralCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transactions: true,
            investments: true,
            referrals: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    return success(res, user);
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
