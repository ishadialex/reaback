import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { sendAccountDeactivationEmail } from "../services/notification.service.js";
import { subscribeToNewsletter, unsubscribeFromNewsletter } from "../services/newsletter.service.js";

export async function getSettings(req: Request, res: Response) {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.userId },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.userId! },
      });
    }

    return success(res, {
      emailNotifications: settings.emailNotifications,
      pushNotifications: settings.pushNotifications,
      marketingEmails: settings.marketingEmails,
      loginAlerts: settings.loginAlerts,
      sessionTimeout: settings.sessionTimeout,
    });
  } catch (err) {
    console.error("getSettings error:", err);
    return error(res, "Failed to fetch settings", 500);
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const allowedFields = [
      "emailNotifications",
      "pushNotifications",
      "marketingEmails",
      "loginAlerts",
      "sessionTimeout",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }

    // Get current settings to check if marketingEmails changed
    const currentSettings = await prisma.userSettings.findUnique({
      where: { userId: req.userId },
    });

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.userId },
      update: data,
      create: { userId: req.userId!, ...data },
    });

    // Sync with newsletter if marketingEmails changed
    if (req.body.marketingEmails !== undefined &&
        currentSettings?.marketingEmails !== req.body.marketingEmails) {

      // Get user info for newsletter
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (user) {
        if (req.body.marketingEmails === true) {
          // Subscribe to newsletter
          setImmediate(() => {
            subscribeToNewsletter(
              user.email,
              user.firstName,
              user.lastName,
              "settings-page"
            ).catch((err) => console.error("Error subscribing to newsletter:", err));
          });
        } else {
          // Unsubscribe from newsletter
          setImmediate(() => {
            unsubscribeFromNewsletter(user.email)
              .catch((err) => console.error("Error unsubscribing from newsletter:", err));
          });
        }
      }
    }

    return success(
      res,
      {
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
        marketingEmails: settings.marketingEmails,
        loginAlerts: settings.loginAlerts,
        sessionTimeout: settings.sessionTimeout,
      },
      "Settings updated successfully"
    );
  } catch (err) {
    console.error("updateSettings error:", err);
    return error(res, "Failed to update settings", 500);
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body;

    // Fetch user with credentials account
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        accounts: {
          where: { provider: "credentials" },
          select: { id: true, passwordHash: true },
        },
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    const credentialsAccount = user.accounts[0];
    if (!credentialsAccount || !credentialsAccount.passwordHash) {
      return error(res, "No password set for this account. Please use OAuth to sign in.", 400);
    }

    const valid = await comparePassword(currentPassword, credentialsAccount.passwordHash);
    if (!valid) {
      return error(res, "Current password is incorrect", 401);
    }

    const newHash = await hashPassword(newPassword);

    await prisma.account.update({
      where: { id: credentialsAccount.id },
      data: { passwordHash: newHash },
    });

    return success(res, null, "Password changed successfully");
  } catch (err) {
    console.error("changePassword error:", err);
    return error(res, "Failed to change password", 500);
  }
}

export async function deleteAccount(req: Request, res: Response) {
  try {
    const { password } = req.body;

    if (!password) {
      return error(res, "Password is required to delete your account", 400);
    }

    // Fetch user with credentials account for password verification
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        accounts: {
          where: { provider: "credentials" },
          select: { passwordHash: true },
        },
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    const credentialsAccount = user.accounts[0];
    if (!credentialsAccount || !credentialsAccount.passwordHash) {
      return error(res, "Password verification not available for OAuth accounts. Please contact support.", 400);
    }

    // Verify password before deletion
    const isValid = await comparePassword(password, credentialsAccount.passwordHash);
    if (!isValid) {
      return error(res, "Incorrect password. Account deletion cancelled.", 401);
    }

    // Soft delete — preserve all data, just deactivate
    await prisma.user.update({
      where: { id: req.userId },
      data: { isActive: false },
    });

    // Invalidate all active sessions
    await prisma.session.updateMany({
      where: { userId: req.userId },
      data: { isActive: false },
    });

    console.log(`🗑️ Account soft-deleted: ${user.email}`);

    // Send farewell email (async, non-blocking)
    setImmediate(() => {
      sendAccountDeactivationEmail(user!.id, user!.email, user!.firstName).catch(() => {});
    });

    return success(res, null, "Your account has been deactivated. All your data has been retained.");
  } catch (err) {
    console.error("deleteAccount error:", err);
    return error(res, "Failed to delete account", 500);
  }
}
