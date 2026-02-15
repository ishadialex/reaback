import { Request, Response } from "express";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

/**
 * Generate 2FA secret and QR code for user
 * User must be authenticated
 */
export async function setup2FA(req: Request, res: Response) {
  try {
    const userId = req.userId;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    // Check if 2FA is already enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return error(res, "Two-factor authentication is already enabled", 400);
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: `Alvarado Investment (${user.email})`,
      issuer: "Alvarado Investment",
      length: 32,
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || "");

    // Store secret temporarily (not enabled yet)
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    console.log(`🔐 2FA setup initiated for user: ${user.email}`);

    return success(res, {
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      manualEntry: secret.base32,
    });
  } catch (err) {
    console.error("setup2FA error:", err);
    return error(res, "Failed to setup 2FA", 500);
  }
}

/**
 * Enable 2FA after verifying code
 * Generates backup codes
 */
export async function enable2FA(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { code } = req.body;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    if (!code || code.length !== 6) {
      return error(res, "Invalid verification code", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.twoFactorSecret) {
      return error(res, "2FA setup not initiated. Please setup 2FA first.", 400);
    }

    if (user.twoFactorEnabled) {
      return error(res, "2FA is already enabled", 400);
    }

    // Verify the code
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2, // Allow 2 time steps before/after for clock skew
    });

    if (!isValid) {
      console.log(`❌ 2FA enable failed: Invalid code for ${user.email}`);
      return error(res, "Invalid verification code. Please try again.", 400);
    }

    // Generate 10 backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    // Hash backup codes before storing
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash("sha256").update(code).digest("hex")
    );

    // Enable 2FA and store hashed backup codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        backupCodes: hashedBackupCodes,
      },
    });

    console.log(`✅ 2FA enabled successfully for user: ${user.email}`);

    // Return unhashed backup codes (only time user will see them)
    return success(res, {
      enabled: true,
      backupCodes: backupCodes, // Plain text for user to save
    }, "Two-factor authentication has been enabled successfully");
  } catch (err) {
    console.error("enable2FA error:", err);
    return error(res, "Failed to enable 2FA", 500);
  }
}

/**
 * Disable 2FA
 * Requires 2FA code verification for security
 */
export async function disable2FA(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { code } = req.body;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    if (!code || code.length !== 6) {
      return error(res, "Valid 6-digit 2FA code is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    if (!user.twoFactorEnabled) {
      return error(res, "2FA is not enabled", 400);
    }

    // Verify 2FA code (TOTP only, not backup codes)
    const isValidTotp = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!isValidTotp) {
      console.log(`❌ 2FA disable failed: Invalid 2FA code for ${user.email}`);
      return error(res, "Invalid 2FA code. Please try again.", 401);
    }

    // Disable 2FA and clear secrets
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
        requireTwoFactorLogin: false,
      },
    });

    console.log(`🔓 2FA disabled for user: ${user.email}`);

    return success(res, { disabled: true }, "Two-factor authentication has been disabled");
  } catch (err) {
    console.error("disable2FA error:", err);
    return error(res, "Failed to disable 2FA", 500);
  }
}

/**
 * Verify 2FA code during login
 * Called by auth controller
 */
export async function verify2FACode(userId: string, code: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true, backupCodes: true },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // First try TOTP code
    const isValidTotp = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (isValidTotp) {
      return true;
    }

    // If TOTP fails, try backup codes
    const hashedCode = crypto.createHash("sha256").update(code.toUpperCase()).digest("hex");
    const backupCodeIndex = user.backupCodes.findIndex((stored) => stored === hashedCode);

    if (backupCodeIndex !== -1) {
      // Remove used backup code
      const updatedBackupCodes = user.backupCodes.filter((_, index) => index !== backupCodeIndex);
      await prisma.user.update({
        where: { id: userId },
        data: { backupCodes: updatedBackupCodes },
      });

      console.log(`🔑 Backup code used for user ID: ${userId}. Remaining: ${updatedBackupCodes.length}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error("verify2FACode error:", err);
    return false;
  }
}

/**
 * Regenerate backup codes
 * Requires 2FA code for security
 */
export async function regenerateBackupCodes(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { code } = req.body;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    if (!code || code.length !== 6) {
      return error(res, "Valid 6-digit 2FA code is required", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    if (!user.twoFactorEnabled) {
      return error(res, "2FA must be enabled to generate backup codes", 400);
    }

    // Verify 2FA code (TOTP only, not backup codes)
    const isValidTotp = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!isValidTotp) {
      console.log(`❌ Backup code regeneration failed: Invalid 2FA code for ${user.email}`);
      return error(res, "Invalid 2FA code. Please try again.", 401);
    }

    // Generate new backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    // Hash backup codes before storing
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash("sha256").update(code).digest("hex")
    );

    // Update backup codes
    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: hashedBackupCodes },
    });

    console.log(`🔄 Backup codes regenerated for user: ${user.email}`);

    return success(res, {
      backupCodes: backupCodes,
    }, "Backup codes have been regenerated successfully");
  } catch (err) {
    console.error("regenerateBackupCodes error:", err);
    return error(res, "Failed to regenerate backup codes", 500);
  }
}

/**
 * Toggle "Require 2FA on login" setting
 */
export async function requireLogin2FA(req: Request, res: Response) {
  try {
    const userId = req.userId;
    const { require: requireFlag } = req.body;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    if (typeof requireFlag !== "boolean") {
      return error(res, "Invalid request. 'require' must be a boolean.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, email: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    if (!user.twoFactorEnabled) {
      return error(res, "You must enable 2FA before requiring it for login.", 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { requireTwoFactorLogin: requireFlag },
    });

    console.log(`🔐 2FA login requirement ${requireFlag ? "enabled" : "disabled"} for user: ${user.email}`);

    return success(res, {
      requireTwoFactorLogin: requireFlag,
    }, `Two-factor authentication is now ${requireFlag ? "required" : "optional"} for login`);
  } catch (err) {
    console.error("requireLogin2FA error:", err);
    return error(res, "Failed to update 2FA login requirement", 500);
  }
}

/**
 * Get 2FA status
 */
export async function get2FAStatus(req: Request, res: Response) {
  try {
    const userId = req.userId;

    if (!userId) {
      return error(res, "Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        requireTwoFactorLogin: true,
        backupCodes: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    return success(res, {
      enabled: user.twoFactorEnabled,
      requireTwoFactorLogin: user.requireTwoFactorLogin,
      backupCodesCount: user.backupCodes.length,
    });
  } catch (err) {
    console.error("get2FAStatus error:", err);
    return error(res, "Failed to get 2FA status", 500);
  }
}
