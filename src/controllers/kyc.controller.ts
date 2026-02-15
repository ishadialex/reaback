import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { notifyAdminKYCSubmission } from "../services/notification.service.js";

interface MulterFile {
  path: string;
  filename: string;
  originalname: string;
}

/**
 * Get KYC status and details for the authenticated user
 * GET /api/kyc/status
 */
export async function getKYCStatus(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    // Get or create KYC record
    let kyc = await prisma.kYC.findUnique({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        nationality: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        idFrontUrl: true,
        idBackUrl: true,
        proofOfAddressUrl: true,
        selfieUrl: true,
        documentType: true,
        documentNumber: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If no KYC record exists, create one with default values
    if (!kyc) {
      kyc = await prisma.kYC.create({
        data: {
          userId,
          status: "not_submitted",
        },
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          nationality: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          idFrontUrl: true,
          idBackUrl: true,
          proofOfAddressUrl: true,
          selfieUrl: true,
          documentType: true,
          documentNumber: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          rejectionReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return success(res, { kyc });
  } catch (err) {
    console.error("Get KYC status error:", err);
    return error(res, "Failed to retrieve KYC status", 500);
  }
}

/**
 * Submit KYC documents and information
 * POST /api/kyc/submit
 */
export async function submitKYC(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const {
      fullName,
      dateOfBirth,
      nationality,
      address,
      city,
      state,
      postalCode,
      country,
      idFrontUrl,
      idBackUrl,
      proofOfAddressUrl,
      selfieUrl,
      documentType,
      documentNumber,
    } = req.body;

    // Validate required fields
    if (!fullName || !dateOfBirth || !nationality || !country) {
      return error(res, "Full name, date of birth, nationality, and country are required", 400);
    }

    if (!documentType || !documentNumber) {
      return error(res, "Document type and number are required", 400);
    }

    if (!idFrontUrl || !proofOfAddressUrl || !selfieUrl) {
      return error(res, "All document uploads are required (ID front, proof of address, selfie)", 400);
    }

    // ID back is only required for driver's licenses
    if (documentType === "drivers_license" && !idBackUrl) {
      return error(res, "Driver's license requires both front and back images", 400);
    }

    // Check if KYC record exists
    const existingKYC = await prisma.kYC.findUnique({
      where: { userId },
      select: { status: true },
    });

    // Prevent resubmission if already approved
    if (existingKYC?.status === "approved") {
      return error(res, "Your KYC is already approved. No changes allowed.", 400);
    }

    // Prevent resubmission if pending review
    if (existingKYC?.status === "pending") {
      return error(res, "Your KYC is currently under review. Please wait for admin approval.", 400);
    }

    // Create or update KYC record
    const kyc = await prisma.kYC.upsert({
      where: { userId },
      create: {
        userId,
        fullName,
        dateOfBirth,
        nationality,
        address: address || "",
        city: city || "",
        state: state || "",
        postalCode: postalCode || "",
        country,
        idFrontUrl,
        idBackUrl,
        proofOfAddressUrl,
        selfieUrl,
        documentType,
        documentNumber,
        status: "pending",
        submittedAt: new Date(),
      },
      update: {
        fullName,
        dateOfBirth,
        nationality,
        address: address || "",
        city: city || "",
        state: state || "",
        postalCode: postalCode || "",
        country,
        idFrontUrl,
        idBackUrl,
        proofOfAddressUrl,
        selfieUrl,
        documentType,
        documentNumber,
        status: "pending",
        submittedAt: new Date(),
        rejectionReason: "", // Clear previous rejection reason
        adminNotes: "", // Clear previous admin notes
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
      },
    });

    // Update user's kycStatus and get user email for notification
    const user = await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "pending" },
      select: { email: true },
    });

    console.log(`📝 KYC submitted for user: ${userId}`);

    // Send admin notification asynchronously
    setImmediate(() => {
      notifyAdminKYCSubmission(
        fullName,
        user.email,
        userId,
        kyc.id,
        documentType,
        nationality
      ).catch((err) => console.error("Error sending KYC admin notification:", err));
    });

    return success(res, { kyc }, "KYC documents submitted successfully. Our team will review your submission shortly.");
  } catch (err) {
    console.error("Submit KYC error:", err);
    return error(res, "Failed to submit KYC documents", 500);
  }
}

/**
 * Update KYC information (only if not submitted or rejected)
 * PUT /api/kyc/update
 */
export async function updateKYC(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const {
      fullName,
      dateOfBirth,
      nationality,
      address,
      city,
      state,
      postalCode,
      country,
      idFrontUrl,
      idBackUrl,
      proofOfAddressUrl,
      selfieUrl,
      documentType,
      documentNumber,
    } = req.body;

    // Get current KYC record
    const existingKYC = await prisma.kYC.findUnique({
      where: { userId },
      select: { status: true },
    });

    if (!existingKYC) {
      return error(res, "No KYC record found. Please submit KYC first.", 404);
    }

    // Only allow updates if status is not_submitted or rejected
    if (existingKYC.status === "approved") {
      return error(res, "Your KYC is already approved. No changes allowed.", 400);
    }

    if (existingKYC.status === "pending") {
      return error(res, "Your KYC is under review. Please wait for the review to complete.", 400);
    }

    // Update KYC record
    const updatedData: any = {};
    if (fullName !== undefined) updatedData.fullName = fullName;
    if (dateOfBirth !== undefined) updatedData.dateOfBirth = dateOfBirth;
    if (nationality !== undefined) updatedData.nationality = nationality;
    if (address !== undefined) updatedData.address = address;
    if (city !== undefined) updatedData.city = city;
    if (state !== undefined) updatedData.state = state;
    if (postalCode !== undefined) updatedData.postalCode = postalCode;
    if (country !== undefined) updatedData.country = country;
    if (idFrontUrl !== undefined) updatedData.idFrontUrl = idFrontUrl;
    if (idBackUrl !== undefined) updatedData.idBackUrl = idBackUrl;
    if (proofOfAddressUrl !== undefined) updatedData.proofOfAddressUrl = proofOfAddressUrl;
    if (selfieUrl !== undefined) updatedData.selfieUrl = selfieUrl;
    if (documentType !== undefined) updatedData.documentType = documentType;
    if (documentNumber !== undefined) updatedData.documentNumber = documentNumber;

    const kyc = await prisma.kYC.update({
      where: { userId },
      data: updatedData,
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        nationality: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        idFrontUrl: true,
        idBackUrl: true,
        proofOfAddressUrl: true,
        selfieUrl: true,
        documentType: true,
        documentNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    return success(res, { kyc }, "KYC information updated successfully");
  } catch (err) {
    console.error("Update KYC error:", err);
    return error(res, "Failed to update KYC information", 500);
  }
}

/**
 * Upload KYC document
 * POST /api/kyc/upload-document
 */
export async function uploadKYCDocument(req: Request, res: Response) {
  try {
    const file = req.file as MulterFile;

    if (!file) {
      return error(res, "No file uploaded", 400);
    }

    // Cloudinary URL is in file.path
    const fileUrl = file.path;

    return success(res, { fileUrl }, "Document uploaded successfully");
  } catch (err) {
    console.error("Upload KYC document error:", err);
    return error(res, "Failed to upload document", 500);
  }
}
