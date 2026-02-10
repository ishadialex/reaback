import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { verify2FACode } from "./twoFactor.controller.js";
import {
  sendTransferSentNotification,
  sendTransferReceivedNotification,
} from "../services/notification.service.js";

export async function getTransfers(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    const transfers = await prisma.transfer.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });

    return success(res, { balance: user.balance, transfers });
  } catch (err) {
    return error(res, "Failed to fetch transfers", 500);
  }
}

export async function getTransferAuthorizationStatus(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        kycStatus: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    const twoFactorEnabled = user.twoFactorEnabled;
    const kycVerified = user.kycStatus === "verified";
    const canTransfer = twoFactorEnabled && kycVerified;

    const reasons: string[] = [];
    if (!twoFactorEnabled) {
      reasons.push("Two-factor authentication must be enabled");
    }
    if (!kycVerified) {
      reasons.push("KYC verification required");
    }

    return success(res, {
      canTransfer,
      twoFactorEnabled,
      kycVerified,
      kycStatus: user.kycStatus,
      reasons,
    });
  } catch (err) {
    return error(res, "Failed to check authorization status", 500);
  }
}

export async function createTransfer(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { recipientEmail, amount, note, twoFactorCode } = req.body;

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        balance: true,
        email: true,
        firstName: true,
        lastName: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        kycStatus: true,
      },
    });

    if (!sender) {
      return error(res, "User not found", 404);
    }

    // Check if 2FA is enabled
    if (!sender.twoFactorEnabled || !sender.twoFactorSecret) {
      return error(
        res,
        "Two-factor authentication must be enabled to send transfers. Please enable 2FA in security settings.",
        403
      );
    }

    // Check KYC verification status
    if (sender.kycStatus !== "verified") {
      return error(
        res,
        "KYC verification is required to send transfers. Please complete KYC verification in settings.",
        403
      );
    }

    // Verify 2FA code
    const is2FAValid = await verify2FACode(userId, twoFactorCode);
    if (!is2FAValid) {
      return error(res, "Invalid 2FA code. Please try again.", 401);
    }

    if (sender.email === recipientEmail) {
      return error(res, "Cannot transfer to yourself");
    }

    if (sender.balance < amount) {
      return error(res, "Insufficient balance");
    }

    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    const transfer = await prisma.$transaction(async (tx) => {
      const newTransfer = await tx.transfer.create({
        data: {
          senderId: userId,
          recipientId: recipient?.id || null,
          recipientEmail,
          amount,
          note: note || "",
          status: recipient ? "completed" : "pending",
          completedAt: recipient ? new Date() : null,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "transfer_sent",
          amount: -amount,
          status: "completed",
          description: `Transfer to ${recipientEmail}`,
          reference: newTransfer.id,
        },
      });

      if (recipient) {
        await tx.user.update({
          where: { id: recipient.id },
          data: { balance: { increment: amount } },
        });

        await tx.transaction.create({
          data: {
            userId: recipient.id,
            type: "transfer_received",
            amount,
            status: "completed",
            description: `Transfer from ${sender.email}`,
            reference: newTransfer.id,
          },
        });
      }

      return newTransfer;
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    // Send notifications asynchronously
    setImmediate(async () => {
      try {
        await sendTransferSentNotification(
          userId,
          sender.email,
          recipientEmail,
          amount,
          updatedUser!.balance,
          transfer.id
        );

        if (recipient) {
          const updatedRecipient = await prisma.user.findUnique({
            where: { id: recipient.id },
            select: { balance: true },
          });

          await sendTransferReceivedNotification(
            recipient.id,
            recipient.email,
            sender.email,
            amount,
            updatedRecipient!.balance,
            transfer.id
          );
        }
      } catch (notifError) {
        console.error("Error sending transfer notifications:", notifError);
      }
    });

    return success(
      res,
      {
        transfer,
        balance: updatedUser!.balance,
        recipientExists: !!recipient,
      },
      "Transfer successful",
      201
    );
  } catch (err) {
    return error(res, "Failed to create transfer", 500);
  }
}
