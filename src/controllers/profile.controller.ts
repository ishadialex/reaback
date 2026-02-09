import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function getProfile(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
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
        emailVerified: true,
        twoFactorEnabled: true,
        kycStatus: true,
        balance: true,
        referralCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    return success(res, user);
  } catch (err) {
    console.error("getProfile error:", err);
    return error(res, "Failed to fetch profile", 500);
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "dateOfBirth",
      "nationality",
      "address",
      "city",
      "state",
      "postalCode",
      "country",
      "profilePhoto",
      "bio",
      "occupation",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
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
        emailVerified: true,
        twoFactorEnabled: true,
        kycStatus: true,
        balance: true,
        referralCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return success(res, user, "Profile updated successfully");
  } catch (err) {
    console.error("updateProfile error:", err);
    return error(res, "Failed to update profile", 500);
  }
}

export async function uploadPhoto(req: Request, res: Response) {
  try {
    if (!req.file) {
      return error(res, "No file uploaded", 400);
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;

    await prisma.user.update({
      where: { id: req.userId },
      data: { profilePhoto: url },
    });

    return success(res, { url }, "Profile photo updated successfully");
  } catch (err) {
    console.error("uploadPhoto error:", err);
    return error(res, "Failed to upload photo", 500);
  }
}
