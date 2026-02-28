import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";
import { sendDocumentForSigningNotification } from "../../services/notification.service.js";
import { fetchCloudinaryFile } from "../documents.controller.js";

// GET /api/admin/documents
export async function listDocuments(req: Request, res: Response) {
  try {
    const { userId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = {};
    if (userId) where.userId = String(userId);
    if (status) where.status = String(status);

    const [docs, total] = await Promise.all([
      prisma.documentSigningRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.documentSigningRequest.count({ where }),
    ]);

    return success(res, { docs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("listDocuments error:", err);
    return error(res, "Failed to fetch documents", 500);
  }
}

// POST /api/admin/documents/send  (multipart: file + fields)
export async function sendDocument(req: Request, res: Response) {
  try {
    const file = (req as any).file;
    if (!file) {
      return error(res, "PDF file is required", 400);
    }

    const { userId, title, description = "", userMessage = "", fields: fieldsRaw = "[]" } = req.body as {
      userId: string;
      title: string;
      description?: string;
      userMessage?: string;
      fields?: string;
    };

    if (!userId || !title) {
      return error(res, "userId and title are required", 400);
    }

    // Parse and validate the fields JSON array
    let fields: unknown[] = [];
    try {
      const parsed = JSON.parse(fieldsRaw);
      if (Array.isArray(parsed)) fields = parsed;
    } catch {
      return error(res, "Invalid fields JSON", 400);
    }

    // Verify user exists and get contact details for notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) {
      return error(res, "User not found", 404);
    }

    // file.path is the Cloudinary URL (multer-cloudinary storage handles upload automatically)
    const documentUrl = file.path;

    const doc = await prisma.documentSigningRequest.create({
      data: {
        userId,
        title,
        description,
        userMessage,
        documentUrl,
        status: "pending",
        fields: fields as any,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Fire email + push notification (non-blocking — never fail the response over it)
    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    sendDocumentForSigningNotification(
      userId,
      user.email,
      userName,
      title,
      userMessage
    ).catch((err) => console.error("sendDocumentForSigningNotification failed:", err));

    return success(res, doc, "Document sent successfully", 201);
  } catch (err) {
    console.error("sendDocument error:", err);
    return error(res, "Failed to send document", 500);
  }
}

// GET /api/admin/documents/:id/download?signed=true
export async function downloadDocument(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const wantSigned = req.query.signed === "true";

    const doc = await prisma.documentSigningRequest.findUnique({ where: { id } });
    if (!doc) return error(res, "Document not found", 404);

    const fileUrl = wantSigned ? doc.signedDocumentUrl : doc.documentUrl;
    if (!fileUrl) return error(res, "File not available", 404);

    const filename = `${doc.title.replace(/[^a-z0-9]/gi, "_")}${wantSigned ? "_signed" : ""}.pdf`;

    const buffer = await fetchCloudinaryFile(fileUrl);
    if (!buffer) return error(res, "File not available from storage", 502);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.end(buffer);
  } catch (err) {
    console.error("admin downloadDocument error:", err);
    return error(res, "Failed to download document", 500);
  }
}

// DELETE /api/admin/documents/:id
export async function deleteDocument(req: Request, res: Response) {
  try {
    const id = String(req.params.id);

    const doc = await prisma.documentSigningRequest.findUnique({ where: { id } });
    if (!doc) {
      return error(res, "Document not found", 404);
    }

    await prisma.documentSigningRequest.delete({ where: { id } });
    return success(res, null, "Document deleted");
  } catch (err) {
    console.error("deleteDocument error:", err);
    return error(res, "Failed to delete document", 500);
  }
}
