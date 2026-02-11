import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";

interface VerifyPasscodeRequest {
  passcode: string;
}

interface CreatePdfDocumentRequest {
  title: string;
  description?: string;
  filePath: string;
  fileUrl: string;
  displayOrder?: number;
  category?: string;
}

interface UpdatePdfDocumentRequest {
  title?: string;
  description?: string;
  filePath?: string;
  fileUrl?: string;
  displayOrder?: number;
  category?: string;
  isActive?: boolean;
}

/**
 * POST /api/pdf/verify-passcode
 * Verify PDF access passcode against multiple allowed passcodes
 */
export async function verifyPasscode(
  req: Request<{}, {}, VerifyPasscodeRequest>,
  res: Response
) {
  try {
    const { passcode } = req.body;

    // Validate request
    if (!passcode || typeof passcode !== "string") {
      return error(res, "Passcode is required", 400);
    }

    // Get passcodes from environment variable (comma-separated)
    const passcodesString = env.PDF_ACCESS_PASSCODES;

    if (!passcodesString) {
      console.error("PDF_ACCESS_PASSCODES not set in environment variables");
      return error(res, "PDF access is not configured on this server", 500);
    }

    // Split passcodes by comma and trim whitespace
    let allowedPasscodes = passcodesString
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code.length > 0); // Remove empty strings

    // Limit to 10 passcodes maximum
    if (allowedPasscodes.length > 10) {
      console.warn(
        `Warning: More than 10 passcodes configured. Only using first 10.`
      );
      allowedPasscodes = allowedPasscodes.slice(0, 10);
    }

    if (allowedPasscodes.length === 0) {
      console.error("No valid passcodes found in PDF_ACCESS_PASSCODES");
      return error(res, "PDF access is not configured on this server", 500);
    }

    console.log(
      `🔐 Checking PDF passcode against ${allowedPasscodes.length} configured passcode(s)`
    );

    // Verify passcode matches any of the allowed passcodes
    if (allowedPasscodes.includes(passcode)) {
      console.log(`✅ Valid PDF passcode provided`);
      return success(res, null, "Access granted");
    } else {
      console.log(`❌ Invalid PDF passcode attempt`);
      return error(res, "Invalid passcode", 401);
    }
  } catch (err) {
    console.error("Error verifying PDF passcode:", err);
    return error(res, "An error occurred while verifying passcode", 500);
  }
}

/**
 * GET /api/pdf/documents
 * Get all active PDF documents for display in menu
 */
export async function getPdfDocuments(req: Request, res: Response) {
  try {
    const documents = await prisma.pdfDocument.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        fileUrl: true,
        displayOrder: true,
        category: true,
      },
      orderBy: [
        { displayOrder: "asc" },
        { title: "asc" },
      ],
    });

    console.log(`📄 Fetched ${documents.length} active PDF document(s)`);
    return success(res, documents);
  } catch (err) {
    console.error("Error fetching PDF documents:", err);
    return error(res, "Failed to fetch PDF documents", 500);
  }
}

/**
 * GET /api/pdf/documents/:id
 * Get single PDF document by ID
 */
export async function getPdfDocument(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const document = await prisma.pdfDocument.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        fileUrl: true,
        displayOrder: true,
        category: true,
      },
    });

    if (!document) {
      return error(res, "PDF document not found", 404);
    }

    console.log(`📄 Fetched PDF document: ${document.title}`);
    return success(res, document);
  } catch (err) {
    console.error("Error fetching PDF document:", err);
    return error(res, "Failed to fetch PDF document", 500);
  }
}

/**
 * POST /api/pdf/documents
 * Create new PDF document (admin only)
 */
export async function createPdfDocument(
  req: Request<{}, {}, CreatePdfDocumentRequest>,
  res: Response
) {
  try {
    const {
      title,
      description = "",
      filePath,
      fileUrl,
      displayOrder = 0,
      category = "General",
    } = req.body;

    // Validate required fields
    if (!title || !filePath || !fileUrl) {
      return error(res, "Title, filePath, and fileUrl are required", 400);
    }

    const document = await prisma.pdfDocument.create({
      data: {
        title,
        description,
        filePath,
        fileUrl,
        displayOrder,
        category,
      },
    });

    console.log(`✅ Created PDF document: ${document.title}`);
    return success(res, document, "PDF document created successfully", 201);
  } catch (err) {
    console.error("Error creating PDF document:", err);
    return error(res, "Failed to create PDF document", 500);
  }
}

/**
 * PUT /api/pdf/documents/:id
 * Update PDF document (admin only)
 */
export async function updatePdfDocument(
  req: Request<{ id: string }, {}, UpdatePdfDocumentRequest>,
  res: Response
) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updates = req.body;

    // Check if document exists
    const existing = await prisma.pdfDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      return error(res, "PDF document not found", 404);
    }

    const document = await prisma.pdfDocument.update({
      where: { id },
      data: updates,
    });

    console.log(`✅ Updated PDF document: ${document.title}`);
    return success(res, document, "PDF document updated successfully");
  } catch (err) {
    console.error("Error updating PDF document:", err);
    return error(res, "Failed to update PDF document", 500);
  }
}

/**
 * DELETE /api/pdf/documents/:id
 * Soft delete PDF document (admin only)
 */
export async function deletePdfDocument(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Check if document exists
    const existing = await prisma.pdfDocument.findUnique({
      where: { id },
    });

    if (!existing) {
      return error(res, "PDF document not found", 404);
    }

    // Soft delete by setting isActive to false
    await prisma.pdfDocument.update({
      where: { id },
      data: { isActive: false },
    });

    console.log(`🗑️ Deactivated PDF document: ${existing.title}`);
    return success(res, null, "PDF document deactivated successfully");
  } catch (err) {
    console.error("Error deleting PDF document:", err);
    return error(res, "Failed to delete PDF document", 500);
  }
}
