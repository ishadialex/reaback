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
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    // Compute dynamic balance from transactions + completed fund operations
    const [transactions, completedFundOps] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: "completed" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: { in: ["completed", "approved"] } },
        select: { type: true, amount: true },
      }),
    ]);

    let balance = 0;
    for (const tx of transactions) {
      switch (tx.type) {
        case "deposit":
        case "profit":
        case "admin_bonus":
        case "referral":
        case "transfer_received":
          balance += tx.amount;
          break;
        case "withdrawal":
        case "investment":
        case "transfer_sent":
          balance -= Math.abs(tx.amount);
          break;
      }
    }
    for (const op of completedFundOps) {
      if (op.type === "deposit") balance += op.amount;
      else if (op.type === "withdrawal") balance -= op.amount;
    }

    const transfers = await prisma.transfer.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });

    return success(res, { balance, transfers });
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

    // Compute dynamic balance from transactions + completed fund operations
    const [transactions, completedFundOps] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: "completed" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: { in: ["completed", "approved"] } },
        select: { type: true, amount: true },
      }),
    ]);

    let balance = 0;
    for (const tx of transactions) {
      switch (tx.type) {
        case "deposit":
        case "profit":
        case "admin_bonus":
        case "referral":
        case "transfer_received":
          balance += tx.amount;
          break;
        case "withdrawal":
        case "investment":
        case "transfer_sent":
          balance -= Math.abs(tx.amount);
          break;
      }
    }
    for (const op of completedFundOps) {
      if (op.type === "deposit") balance += op.amount;
      else if (op.type === "withdrawal") balance -= op.amount;
    }

    if (balance < amount) {
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

    // Recalculate sender's balance after transfer
    const [updatedTransactions, updatedFundOps] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, status: "completed" },
        select: { type: true, amount: true },
      }),
      prisma.fundOperation.findMany({
        where: { userId, status: { in: ["completed", "approved"] } },
        select: { type: true, amount: true },
      }),
    ]);

    let updatedBalance = 0;
    for (const tx of updatedTransactions) {
      switch (tx.type) {
        case "deposit":
        case "profit":
        case "admin_bonus":
        case "referral":
        case "transfer_received":
          updatedBalance += tx.amount;
          break;
        case "withdrawal":
        case "investment":
        case "transfer_sent":
          updatedBalance -= Math.abs(tx.amount);
          break;
      }
    }
    for (const op of updatedFundOps) {
      if (op.type === "deposit") updatedBalance += op.amount;
      else if (op.type === "withdrawal") updatedBalance -= op.amount;
    }

    // Send notifications asynchronously
    setImmediate(async () => {
      try {
        await sendTransferSentNotification(
          userId,
          sender.email,
          recipientEmail,
          amount,
          updatedBalance,
          transfer.id
        );

        if (recipient) {
          // Calculate recipient's updated balance
          const [recipientTransactions, recipientFundOps] = await Promise.all([
            prisma.transaction.findMany({
              where: { userId: recipient.id, status: "completed" },
              select: { type: true, amount: true },
            }),
            prisma.fundOperation.findMany({
              where: { userId: recipient.id, status: { in: ["completed", "approved"] } },
              select: { type: true, amount: true },
            }),
          ]);

          let recipientBalance = 0;
          for (const tx of recipientTransactions) {
            switch (tx.type) {
              case "deposit":
              case "profit":
              case "admin_bonus":
              case "referral":
              case "transfer_received":
                recipientBalance += tx.amount;
                break;
              case "withdrawal":
              case "investment":
              case "transfer_sent":
                recipientBalance -= Math.abs(tx.amount);
                break;
            }
          }
          for (const op of recipientFundOps) {
            if (op.type === "deposit") recipientBalance += op.amount;
            else if (op.type === "withdrawal") recipientBalance -= op.amount;
          }

          await sendTransferReceivedNotification(
            recipient.id,
            recipient.email,
            sender.email,
            amount,
            recipientBalance,
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
        balance: updatedBalance,
        recipientExists: !!recipient,
      },
      "Transfer successful",
      201
    );
  } catch (err) {
    return error(res, "Failed to create transfer", 500);
  }
}
