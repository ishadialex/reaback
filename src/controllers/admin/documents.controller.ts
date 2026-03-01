import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { cloudinary } from "../../config/cloudinary.js";
import { success, error } from "../../utils/response.js";
import { sendDocumentForSigningNotification } from "../../services/notification.service.js";
import { fetchCloudinaryFile } from "../documents.controller.js";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

/**
 * Attempt to download a Cloudinary raw resource using the Admin API download
 * endpoint, which bypasses CDN delivery restrictions that affect raw resources.
 * This is a fallback for signed PDFs stored before the resource_type was changed
 * to "image".
 */
async function fetchRawCloudinaryFile(storedUrl: string): Promise<Buffer | null> {
  try {
    const uploadIndex = storedUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    const afterUpload = storedUrl.slice(uploadIndex + 8);
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");

    const cloudName = cloudinary.config().cloud_name;
    const apiKey    = cloudinary.config().api_key;
    const apiSecret = cloudinary.config().api_secret;
    if (!cloudName || !apiKey || !apiSecret) return null;

    const timestamp = Math.round(Date.now() / 1000);
    const sigParams = { public_id: withoutVersion, timestamp };
    const signature = (cloudinary.utils as any).api_sign_request(sigParams, apiSecret);
    const adminUrl  = `https://api.cloudinary.com/v1_1/${cloudName}/raw/download`
      + `?public_id=${encodeURIComponent(withoutVersion)}`
      + `&api_key=${encodeURIComponent(apiKey)}`
      + `&timestamp=${timestamp}`
      + `&signature=${signature}`;

    const res = await fetch(adminUrl);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    console.warn(`admin fetchRawCloudinaryFile: admin-api-download → ${res.status}`);
    return null;
  } catch (e) {
    console.warn("admin fetchRawCloudinaryFile error:", e);
    return null;
  }
}

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

    let buffer = await fetchCloudinaryFile(fileUrl);
    // Fallback for signed PDFs stored as raw Cloudinary resources (older documents)
    if (!buffer && wantSigned) buffer = await fetchRawCloudinaryFile(fileUrl);
    if (!buffer) return error(res, "File not available from storage", 502);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.end(buffer);
  } catch (err) {
    console.error("admin downloadDocument error:", err);
    return error(res, "Failed to download document", 500);
  }
}

// PATCH /api/admin/documents/:id
export async function updateDocument(req: Request, res: Response) {
  try {
    const id = String(req.params.id);

    const doc = await prisma.documentSigningRequest.findUnique({ where: { id } });
    if (!doc) return error(res, "Document not found", 404);

    const { title, description, userMessage, status } = req.body as {
      title?: string;
      description?: string;
      userMessage?: string;
      status?: string;
    };
    const file = (req as any).file;

    const data: Record<string, unknown> = {};
    if (title !== undefined)       data.title = String(title);
    if (description !== undefined) data.description = String(description);
    if (userMessage !== undefined) data.userMessage = String(userMessage);
    if (status !== undefined)      data.status = String(status);

    if (file) {
      data.documentUrl       = file.path;  // new Cloudinary URL
      data.signedDocumentUrl = null;
      data.signatureImageUrl = null;
      data.signedAt          = null;
      data.status            = "pending";  // PDF replaced → must re-sign
    }

    if (Object.keys(data).length === 0) return error(res, "No fields provided to update", 400);

    const updated = await prisma.documentSigningRequest.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return success(res, updated, "Document updated successfully");
  } catch (err) {
    console.error("updateDocument error:", err);
    return error(res, "Failed to update document", 500);
  }
}

// POST /api/admin/documents/:id/admin-sign
export async function adminSignDocument(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const doc = await prisma.documentSigningRequest.findUnique({ where: { id } });
    if (!doc) return error(res, "Document not found", 404);

    const { fieldValues = [], freePlacements = [] } = req.body as {
      fieldValues?: Array<{ fieldId: string; value: string; sigW?: number; sigH?: number }>;
      freePlacements?: Array<{ type: string; value: string; xPct: number; yPct: number; wPct: number; hPct: number; pageNum: number; rotation?: number }>;
      canvasW?: number;
    };

    // Use signed version as base if available, else original
    const baseUrl = doc.signedDocumentUrl ?? doc.documentUrl;
    console.log("adminSignDocument: fetching base PDF from", baseUrl);
    let pdfBytes = await fetchCloudinaryFile(baseUrl);
    // Fallback: if image-type fetch fails, try raw admin API (for older docs)
    if (!pdfBytes) pdfBytes = await fetchRawCloudinaryFile(baseUrl);
    if (!pdfBytes) return error(res, "Could not fetch base PDF", 502);
    console.log("adminSignDocument: PDF fetched, bytes=", pdfBytes.length);

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    } catch (loadErr) {
      console.error("adminSignDocument: PDFDocument.load failed:", loadErr);
      return error(res, "Could not parse base PDF", 500);
    }

    const pages  = pdfDoc.getPages();
    console.log("adminSignDocument: pages=", pages.length, "fields=", (fieldValues as any[]).length, "freePlacements=", (freePlacements as any[]).length);
    let font: any = null;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Helper: embed image (PNG or JPEG) from a data URL
    const embedImage = async (dataUrl: string) => {
      const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buf  = Buffer.from(b64, "base64");
      // Detect by magic bytes: PNG starts with 0x89 0x50 0x4E 0x47
      if (buf[0] === 0x89 && buf[1] === 0x50) return pdfDoc.embedPng(buf);
      // JPEG starts with 0xFF 0xD8
      if (buf[0] === 0xFF && buf[1] === 0xD8) return pdfDoc.embedJpg(buf);
      // Default: try PNG
      return pdfDoc.embedPng(buf);
    };

    // Render admin-assigned guided fields
    const docFields = Array.isArray(doc.fields) ? (doc.fields as any[]) : [];
    const fvMap = new Map((fieldValues as any[]).map((fv: any) => [fv.fieldId, fv]));

    for (const field of docFields) {
      if (field.assignedTo !== "admin") continue;
      const fv = fvMap.get(field.id) as any;
      if (!fv?.value) continue;

      try {
        const pageIdx = field.pageNum != null ? field.pageNum - 1 : pages.length - 1;
        const pg = pages[Math.max(0, Math.min(pageIdx, pages.length - 1))];
        const { width: pgW, height: pgH } = pg.getSize();
        const fx = field.xPct * pgW;
        const fh = field.hPct * pgH;
        const fy = Math.max(0, pgH * (1 - field.yPct) - fh);

        if (field.type === "signature" || field.type === "stamp") {
          const img = await embedImage(fv.value);
          pg.drawImage(img, { x: Math.max(0, fx), y: fy, width: field.wPct * pgW, height: fh });
        } else {
          if (!font) font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          let text = String(fv.value ?? "").trim();
          if (field.type === "date") {
            const d = new Date(text + "T00:00:00");
            const m = MONTHS[d.getMonth()];
            if (m) text = `${m} ${d.getDate()}, ${d.getFullYear()}`;
          }
          if (text) {
            pg.drawText(text, {
              x: Math.max(0, fx),
              y: Math.max(0, pgH * (1 - field.yPct) - fh * 0.7),
              size: 10, font, color: rgb(0, 0, 0),
            });
          }
        }
      } catch (fieldErr) {
        console.error(`adminSignDocument: guided field ${field.id} draw failed (non-fatal):`, fieldErr);
      }
    }

    // Render free-placement items (images with rotation, text without)
    for (const fp of (freePlacements as any[])) {
      try {
        const pageIdx = (fp.pageNum ?? 1) - 1;
        const pg = pages[Math.max(0, Math.min(pageIdx, pages.length - 1))];
        const { width: pgW, height: pgH } = pg.getSize();
        const fw = fp.wPct * pgW;
        const fh = fp.hPct * pgH;

        if (fp.type === "name" || fp.type === "date") {
          // Text placement
          if (!font) font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          let text = String(fp.value ?? "").trim();
          if (fp.type === "date") {
            const d = new Date(text + "T00:00:00");
            const m = MONTHS[d.getMonth()];
            if (m) text = `${m} ${d.getDate()}, ${d.getFullYear()}`;
          }
          if (text) {
            const textX = fp.xPct * pgW;
            const textY = pgH * (1 - fp.yPct) - fh * 0.7;
            pg.drawText(text, {
              x: Math.max(0, textX),
              y: Math.max(0, textY),
              size: Math.max(8, Math.min(fh * 0.6, 14)),
              font,
              color: rgb(0, 0, 0),
            });
          }
        } else {
          // Image placement (signature / stamp) — rotate around center
          const cx = fp.xPct * pgW + fw / 2;
          const cy = pgH * (1 - fp.yPct) - fh / 2;
          const θ  = fp.rotation ?? 0;
          const rad = (θ * Math.PI) / 180;
          const cosθ = Math.cos(rad), sinθ = Math.sin(rad);
          const tx = cx - cosθ * fw / 2 - sinθ * fh / 2;
          const ty = cy + sinθ * fw / 2 - cosθ * fh / 2;
          const img = await embedImage(fp.value);
          pg.drawImage(img, { x: tx, y: ty, width: fw, height: fh, rotate: degrees(-θ) });
        }
      } catch (fpErr) {
        console.error(`adminSignDocument: free placement type=${fp.type} draw failed (non-fatal):`, fpErr);
      }
    }

    console.log("adminSignDocument: saving PDF...");
    const signedPdfBytes = await pdfDoc.save({ updateFieldAppearances: false });
    console.log("adminSignDocument: PDF saved, uploading to Cloudinary, size=", signedPdfBytes.length);

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "alvarado/signed-documents",
          resource_type: "image",
          public_id: `admin_signed_${id}_${Date.now()}`,
          format: "pdf",
        },
        (err, result) => {
          if (err || !result) reject(err || new Error("Cloudinary upload returned no result"));
          else resolve(result as any);
        }
      ).end(Buffer.from(signedPdfBytes));
    });
    console.log("adminSignDocument: upload success, url=", uploadResult.secure_url);

    const updated = await prisma.documentSigningRequest.update({
      where: { id },
      data: { signedDocumentUrl: uploadResult.secure_url, signedAt: new Date() },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    return success(res, updated, "Document signed successfully");
  } catch (err) {
    console.error("adminSignDocument error:", err);
    return error(res, "Failed to sign document", 500);
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
