import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import fs from "fs";
import path from "path";

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
 * Helper function to verify passcode
 */
function verifyPasscodeHelper(passcode: string): boolean {
  const passcodesString = env.PDF_ACCESS_PASSCODES;

  if (!passcodesString) {
    return false;
  }

  const allowedPasscodes = passcodesString
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code.length > 0);

  return allowedPasscodes.includes(passcode);
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

/**
 * GET /api/pdf/serve/:filename
 * Securely serve PDF file with passcode verification
 */
export async function servePdfFile(req: Request, res: Response) {
  try {
    const filename = Array.isArray(req.params.filename)
      ? req.params.filename[0]
      : req.params.filename;

    // Get passcode from Authorization header or query param
    const passcode =
      req.headers.authorization?.replace("Bearer ", "") ||
      (req.query.passcode as string);

    if (!passcode) {
      return res.status(401).json({
        success: false,
        message: "Passcode required. Use Authorization: Bearer <passcode> header or ?passcode=<passcode> query parameter",
      });
    }

    // Verify passcode
    if (!verifyPasscodeHelper(passcode)) {
      console.log(`❌ Invalid passcode attempt for PDF: ${filename}`);
      return res.status(403).json({
        success: false,
        message: "Invalid passcode",
      });
    }

    // Check if file exists in database
    const document = await prisma.pdfDocument.findFirst({
      where: {
        fileUrl: `/pdfs/${filename}`,
        isActive: true,
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "PDF not found",
      });
    }

    // Construct file path
    const filePath = path.join(process.cwd(), "public", "pdfs", filename);

    // Check if file exists on filesystem
    if (!fs.existsSync(filePath)) {
      console.error(`PDF file not found on filesystem: ${filePath}`);
      return res.status(404).json({
        success: false,
        message: "PDF file not found on server",
      });
    }

    // Get file stats for content length
    const stat = fs.statSync(filePath);

    // Set headers for PDF streaming
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, max-age=3600"); // Cache for 1 hour

    console.log(`✅ Serving PDF: ${filename} (${stat.size} bytes)`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      console.error("Error streaming PDF:", err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error streaming PDF file",
        });
      }
    });
  } catch (err) {
    console.error("Error serving PDF file:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to serve PDF file",
      });
    }
  }
}
