import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { cloudinary } from "../config/cloudinary.js";
import jwt from "jsonwebtoken";

interface VerifyPasscodeRequest {
  passcode: string;
}

interface CreatePdfDocumentRequest {
  title: string;
  description?: string;
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
 * Verify PDF access passcode and return JWT token with expiration
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

      // Generate JWT token with expiration (1 hour default)
      const expiresIn: string = env.PDF_TOKEN_EXPIRY;
      const token = jwt.sign(
        {
          purpose: "pdf_access",
          granted: Date.now()
        },
        env.JWT_SECRET,
        { expiresIn } as jwt.SignOptions
      );

      // Calculate expiration timestamp
      const expiryMs = expiresIn.endsWith('h')
        ? parseInt(expiresIn) * 60 * 60 * 1000
        : expiresIn.endsWith('m')
        ? parseInt(expiresIn) * 60 * 1000
        : 60 * 60 * 1000; // Default 1 hour

      const expiresAt = new Date(Date.now() + expiryMs);

      // Set httpOnly cookie for extra security
      res.cookie("pdf_access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: expiryMs,
      });

      return success(res, {
        token,
        expiresAt,
        expiresIn,
      }, "Access granted");
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

    // Prevent caching to ensure clients always get fresh PDF URLs
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

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
    const file = (req as any).file;

    if (!file) {
      return error(res, "PDF file is required", 400);
    }

    const { title, description = "", displayOrder = 0, category = "General" } = req.body;

    if (!title) {
      return error(res, "Title is required", 400);
    }

    // file.path = Cloudinary secure URL, file.filename = Cloudinary public_id
    const fileUrl: string = file.path;
    const filePath: string = file.filename;

    const document = await prisma.pdfDocument.create({
      data: {
        title,
        description,
        filePath,
        fileUrl,
        displayOrder: Number(displayOrder),
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

    // Delete from Cloudinary (filePath stores the public_id)
    if (existing.filePath) {
      try {
        await cloudinary.uploader.destroy(existing.filePath, { resource_type: "raw" });
        console.log(`🗑️ Deleted from Cloudinary: ${existing.filePath}`);
      } catch (cloudErr) {
        console.error("Failed to delete from Cloudinary:", cloudErr);
        // Continue with DB deletion even if Cloudinary fails
      }
    }

    await prisma.pdfDocument.update({
      where: { id },
      data: { isActive: false },
    });

    console.log(`🗑️ Deactivated PDF document: ${existing.title}`);
    return success(res, null, "PDF document deleted successfully");
  } catch (err) {
    console.error("Error deleting PDF document:", err);
    return error(res, "Failed to delete PDF document", 500);
  }
}

/**
 * GET /api/pdf/serve/:id
 * Verify JWT then redirect to the Cloudinary PDF URL
 */
export async function servePdfFile(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Get token from multiple sources (priority order)
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      (req.query.token as string) ||
      req.cookies?.pdf_access_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required. Please verify passcode first.",
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as {
        purpose: string;
        granted: number;
      };

      if (decoded.purpose !== "pdf_access") {
        return res.status(403).json({ success: false, message: "Invalid token purpose" });
      }
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          message: "Access token expired. Please verify passcode again.",
        });
      }
      return res.status(403).json({ success: false, message: "Invalid access token" });
    }

    // Validate MongoDB ObjectId format before querying
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    const document = await prisma.pdfDocument.findUnique({
      where: { id, isActive: true },
    });

    if (!document) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    const grantedTime = new Date(decoded.granted).toISOString();
    console.log(`✅ Serving PDF: ${document.title} - Token granted at: ${grantedTime}`);

    // Redirect to the Cloudinary URL
    return res.redirect(document.fileUrl);
  } catch (err) {
    console.error("Error serving PDF file:", err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Failed to serve PDF file" });
    }
  }
}
