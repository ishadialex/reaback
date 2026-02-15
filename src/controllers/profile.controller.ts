import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { signAccessToken } from "../utils/jwt.js";

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
        requireTwoFactorLogin: true,
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
        requireTwoFactorLogin: true,
        kycStatus: true,
        balance: true,
        referralCode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Generate fresh ACCESS token with updated profile data
    // Keep the same refresh token (it's tied to the session in DB)
    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || undefined;

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });

    return success(res, {
      user,
      accessToken,
    }, "Profile updated successfully");
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

    // Cloudinary returns the URL in req.file.path
    const url = req.file.path;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { profilePhoto: url },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profilePhoto: true,
      },
    });

    // Generate fresh ACCESS token with updated profile photo
    // Keep the same refresh token (it's tied to the session in DB)
    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || undefined;

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });

    return success(res, {
      url,
      accessToken,
    }, "Profile photo updated successfully");
  } catch (err) {
    console.error("uploadPhoto error:", err);
    return error(res, "Failed to upload photo", 500);
  }
}
