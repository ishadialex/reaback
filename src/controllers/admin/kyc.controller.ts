import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import { sendKYCApprovedEmail, sendKYCRejectedEmail } from "../../services/email.service.js";

/**
 * Get all KYC submissions (with filtering and pagination)
 * GET /api/admin/kyc/submissions
 */
export async function getAllKYCSubmissions(req: Request, res: Response) {
  try {
    const { status, page = "1", limit = "20" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = {};
    if (status && status !== "all") {
      where.status = status;
    }

    // Get total count
    const total = await prisma.kYC.count({ where });

    // Get submissions with user info
    const submissions = await prisma.kYC.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            createdAt: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take: limitNum,
    });

    return success(res, {
      submissions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Get KYC submissions error:", err);
    return error(res, "Failed to retrieve KYC submissions", 500);
  }
}

/**
 * Get single KYC submission details
 * GET /api/admin/kyc/submissions/:id
 */
export async function getKYCSubmission(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const submission = await prisma.kYC.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profilePhoto: true,
            createdAt: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!submission) {
      return error(res, "KYC submission not found", 404);
    }

    return success(res, { submission });
  } catch (err) {
    console.error("Get KYC submission error:", err);
    return error(res, "Failed to retrieve KYC submission", 500);
  }
}

/**
 * Approve KYC submission
 * POST /api/admin/kyc/approve/:id
 */
export async function approveKYC(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const adminId = req.userId!;

    // Find KYC submission
    const kycRecord = await prisma.kYC.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!kycRecord) {
      return error(res, "KYC submission not found", 404);
    }

    if (kycRecord.status === "approved") {
      return error(res, "KYC is already approved", 400);
    }

    // Update KYC status to approved
    const updatedKYC = await prisma.kYC.update({
      where: { id },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: adminId,
        adminNotes: adminNotes || "",
        rejectionReason: "", // Clear any previous rejection reason
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update user's kycStatus
    await prisma.user.update({
      where: { id: kycRecord.userId },
      data: { kycStatus: "verified" },
    });

    console.log(`✅ KYC approved for user: ${updatedKYC.user.email} by admin: ${adminId}`);

    // Send email notification to user about KYC approval (non-blocking)
    setImmediate(() => {
      sendKYCApprovedEmail(updatedKYC.user.email, updatedKYC.user.firstName)
        .catch((err) => console.error("Error sending KYC approval email:", err));
    });

    return success(res, { kyc: updatedKYC }, "KYC approved successfully");
  } catch (err) {
    console.error("Approve KYC error:", err);
    return error(res, "Failed to approve KYC", 500);
  }
}

/**
 * Reject KYC submission
 * POST /api/admin/kyc/reject/:id
 */
export async function rejectKYC(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body || {};
    const adminId = req.userId!;

    if (!rejectionReason) {
      return error(res, "Rejection reason is required", 400);
    }

    // Find KYC submission
    const kycRecord = await prisma.kYC.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!kycRecord) {
      return error(res, "KYC submission not found", 404);
    }

    // Update KYC status to rejected
    const updatedKYC = await prisma.kYC.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason,
        adminNotes: adminNotes || "",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update user's kycStatus
    await prisma.user.update({
      where: { id: kycRecord.userId },
      data: { kycStatus: "rejected" },
    });

    console.log(`❌ KYC rejected for user: ${updatedKYC.user.email} by admin: ${adminId}`);

    // Send email notification to user about KYC rejection with reason (non-blocking)
    setImmediate(() => {
      sendKYCRejectedEmail(updatedKYC.user.email, updatedKYC.user.firstName, rejectionReason)
        .catch((err) => console.error("Error sending KYC rejection email:", err));
    });

    return success(res, { kyc: updatedKYC }, "KYC rejected");
  } catch (err) {
    console.error("Reject KYC error:", err);
    return error(res, "Failed to reject KYC", 500);
  }
}

/**
 * Get KYC statistics
 * GET /api/admin/kyc/stats
 */
export async function getKYCStats(req: Request, res: Response) {
  try {
    const [total, pending, approved, rejected, notSubmitted] = await Promise.all([
      prisma.kYC.count(),
      prisma.kYC.count({ where: { status: "pending" } }),
      prisma.kYC.count({ where: { status: "approved" } }),
      prisma.kYC.count({ where: { status: "rejected" } }),
      prisma.kYC.count({ where: { status: "not_submitted" } }),
    ]);

    return success(res, {
      stats: {
        total,
        pending,
        approved,
        rejected,
        notSubmitted,
      },
    });
  } catch (err) {
    console.error("Get KYC stats error:", err);
    return error(res, "Failed to retrieve KYC statistics", 500);
  }
}
