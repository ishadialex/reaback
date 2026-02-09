import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

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

export async function createTransfer(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { recipientEmail, amount, note } = req.body;

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, email: true },
    });

    if (!sender) {
      return error(res, "User not found", 404);
    }

    if (sender.email === recipientEmail) {
      return error(res, "Cannot transfer to yourself");
    }

    if (sender.balance < amount) {
      return error(res, "Insufficient balance");
    }

    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true },
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

    return success(res, { transfer, balance: updatedUser!.balance }, "Transfer successful", 201);
  } catch (err) {
    return error(res, "Failed to create transfer", 500);
  }
}
