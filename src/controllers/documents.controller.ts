import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { cloudinary } from "../config/cloudinary.js";
import { success, error } from "../utils/response.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Cloudinary returns 401 for raw resources when "Authenticated Delivery" is
 * required. Generate a signed delivery URL so the server can fetch it.
 *
 * Input:  https://res.cloudinary.com/<cloud>/<type>/upload/v<ver>/<publicId>.<ext>
 * Output: signed URL with s--<sig>-- token
 */
function signedCloudinaryUrl(storedUrl: string): string {
  const uploadIndex = storedUrl.indexOf("/upload/");
  if (uploadIndex === -1) return storedUrl; // not a Cloudinary URL — return as-is

  // Determine resource type from URL path segment
  const beforeUpload = storedUrl.slice(0, uploadIndex);
  const resourceType = beforeUpload.endsWith("/raw") ? "raw"
    : beforeUpload.endsWith("/video") ? "video"
    : "image";

  // Strip version prefix (v1234567890/)
  const afterUpload = storedUrl.slice(uploadIndex + 8);
  const withoutVersion = afterUpload.replace(/^v\d+\//, "");
  // Raw resource publicIds include the file extension; image/video do not
  const publicId = resourceType === "raw"
    ? withoutVersion
    : withoutVersion.replace(/\.[^/.]+$/, "");

  return cloudinary.url(publicId, {
    resource_type: resourceType as any,
    sign_url: true,
    secure: true,
    type: "upload",
  });
}

// GET /api/documents
export async function getUserDocuments(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const docs = await prisma.documentSigningRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        userMessage: true,
        documentUrl: true,
        signedDocumentUrl: true,
        status: true,
        signedAt: true,
        createdAt: true,
      },
    });

    return success(res, docs);
  } catch (err) {
    console.error("getUserDocuments error:", err);
    return error(res, "Failed to fetch documents", 500);
  }
}

/**
 * Fetch a Cloudinary file as a buffer, trying multiple URL forms to handle
 * both multer uploads (public_id includes extension) and upload_stream uploads
 * with explicit public_id + format (public_id has no extension).
 */
export async function fetchCloudinaryFile(storedUrl: string): Promise<Buffer | null> {
  // 1. Try the stored URL directly (works if Cloudinary delivery is unrestricted)
  let res = await fetch(storedUrl);
  if (res.ok) return Buffer.from(await res.arrayBuffer());

  // 1.5. Try signed URL without version — same approach that successfully fetches
  //      original PDFs in signDocument (signedCloudinaryUrl omits version intentionally)
  const noVersionSigned = signedCloudinaryUrl(storedUrl);
  if (noVersionSigned !== storedUrl) {
    res = await fetch(noVersionSigned);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    console.warn(`downloadDocument: signed-no-version → ${res.status}`);
  }

  const uploadIndex = storedUrl.indexOf("/upload/");
  if (uploadIndex === -1) return null;

  const beforeUpload = storedUrl.slice(0, uploadIndex);
  const resourceType = (beforeUpload.endsWith("/raw") ? "raw"
    : beforeUpload.endsWith("/video") ? "video"
    : "image") as "raw" | "video" | "image";

  const afterUpload = storedUrl.slice(uploadIndex + 8);

  // Extract the real version from the stored URL (e.g. v1772267386)
  const versionMatch = afterUpload.match(/^v(\d+)\//);
  const version = versionMatch ? parseInt(versionMatch[1]) : undefined;
  const withoutVersion = versionMatch ? afterUpload.slice(versionMatch[0].length) : afterUpload;
  const publicIdNoExt = withoutVersion.replace(/\.[^/.]+$/, "");

  // 2. Signed URL with correct version — Cloudinary validates version matches the stored resource
  for (const publicId of [withoutVersion, publicIdNoExt].filter((v, i, a) => a.indexOf(v) === i)) {
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType as any,
      sign_url: true,
      secure: true,
      type: "upload",
      version, // Pass the real version so the signature matches
    });
    res = await fetch(signedUrl);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    console.warn(`downloadDocument: signed(${publicId === withoutVersion ? "with-ext" : "no-ext"}) v${version} → ${res.status}`);
  }

  // 3. Cloudinary admin API → get the authoritative public_id, version, AND type, then sign correctly
  let realPublicId: string | null = null;
  let realVersion: number | undefined;
  let realType = "upload";

  outer: for (const pid of [withoutVersion, publicIdNoExt].filter((v, i, a) => a.indexOf(v) === i)) {
    for (const lookupType of ["upload", "authenticated", "private"]) {
      try {
        const resource = await (cloudinary.api as any).resource(pid, { resource_type: resourceType, type: lookupType });
        realPublicId = resource?.public_id ?? null;
        realVersion = resource?.version;
        realType = resource?.type ?? lookupType;
        console.warn(`downloadDocument: api.resource(${pid}) type=${realType} version=${realVersion} pid=${realPublicId}`);
        if (realPublicId) break outer;
      } catch { continue; }
    }
  }

  if (realPublicId) {
    // 3a. Signed delivery URL using the resource's actual type + version
    const signedUrl = cloudinary.url(realPublicId, {
      resource_type: resourceType as any,
      sign_url: true,
      secure: true,
      type: realType,
      version: realVersion,
    });
    res = await fetch(signedUrl);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    console.warn(`downloadDocument: signed(type=${realType}) → ${res.status}`);

    // 3b. Private download URL — full public_id (with extension) + no format
    try {
      const privateUrl = (cloudinary.utils as any).private_download_url(realPublicId, "", {
        resource_type: resourceType,
        type: realType,
      });
      res = await fetch(privateUrl);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      console.warn(`downloadDocument: private_download(full-pid) → ${res.status}`);
    } catch { /* ignore */ }

    // 3c. Private download URL — split public_id and format
    try {
      const ext = realPublicId.match(/\.([^.]+)$/)?.[1] ?? "";
      const pidNoExt = ext ? realPublicId.slice(0, -(ext.length + 1)) : realPublicId;
      if (pidNoExt !== realPublicId) {
        const privateUrl2 = (cloudinary.utils as any).private_download_url(pidNoExt, ext, {
          resource_type: resourceType,
          type: realType,
        });
        res = await fetch(privateUrl2);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        console.warn(`downloadDocument: private_download(split) → ${res.status}`);
      }
    } catch { /* ignore */ }

    // 3d. Manual Admin API download — bypasses CDN delivery entirely, uses API-tier auth
    //     Same signing mechanism as api.resource() which we know works for this account
    try {
      const cloudName = cloudinary.config().cloud_name!;
      const apiKey = cloudinary.config().api_key!;
      const apiSecret = cloudinary.config().api_secret!;
      const timestamp = Math.round(Date.now() / 1000);
      const sigParams = { public_id: realPublicId, timestamp };
      const signature = (cloudinary.utils as any).api_sign_request(sigParams, apiSecret);
      const adminUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/download`
        + `?public_id=${encodeURIComponent(realPublicId)}`
        + `&api_key=${encodeURIComponent(apiKey)}`
        + `&timestamp=${timestamp}`
        + `&signature=${signature}`;
      res = await fetch(adminUrl);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      console.warn(`downloadDocument: admin-api-download → ${res.status}`);
    } catch (e) {
      console.warn(`downloadDocument: admin-api-download error:`, e);
    }
  }

  return null;
}

// GET /api/documents/:id/download?signed=true
export async function downloadDocument(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const wantSigned = req.query.signed === "true";

    const doc = await prisma.documentSigningRequest.findUnique({ where: { id } });
    if (!doc) {
      console.error(`downloadDocument: document not found id=${id}`);
      return error(res, "Document not found", 404);
    }
    if (doc.userId !== userId) return error(res, "Unauthorized", 403);

    const fileUrl = wantSigned ? doc.signedDocumentUrl : doc.documentUrl;
    if (!fileUrl) {
      console.error(`downloadDocument: no ${wantSigned ? "signed" : "original"} URL for doc id=${id}`);
      return error(res, "File not available", 404);
    }

    const filename = `${doc.title.replace(/[^a-z0-9]/gi, "_")}${wantSigned ? "_signed" : ""}.pdf`;

    const buffer = await fetchCloudinaryFile(fileUrl);
    if (!buffer) {
      console.error(`downloadDocument: all fetch attempts failed for doc id=${id}`);
      return error(res, "File not available from storage", 502);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(buffer);
  } catch (err) {
    console.error("downloadDocument error:", err);
    return error(res, "Failed to download document", 500);
  }
}

// POST /api/documents/:id/sign
export async function signDocument(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const id = String(req.params.id);
    const {
      signatureDataUrl,
      sigPos,
      sigScale = 1,
      nameText,
      namePos,
      dateText,
      datePos,
      canvasW,
      sigDisplayW,
      sigDisplayH,
    } = req.body as {
      signatureDataUrl: string;
      sigPos?: { xPct: number; yPct: number };
      sigScale?: number;
      nameText?: string | null;
      namePos?: { xPct: number; yPct: number };
      dateText?: string | null;
      datePos?: { xPct: number; yPct: number };
      canvasW?: number;
      sigDisplayW?: number;
      sigDisplayH?: number;
    };

    if (!signatureDataUrl) {
      return error(res, "Signature is required", 400);
    }

    // Validate it's a base64 PNG
    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      return error(res, "Signature must be a PNG data URL", 400);
    }

    const doc = await prisma.documentSigningRequest.findUnique({ where: { id } });
    if (!doc) return error(res, "Document not found", 404);
    if (doc.userId !== userId) return error(res, "Unauthorized", 403);
    if (doc.status !== "pending") return error(res, "Document is not pending", 400);

    // Fetch original PDF bytes from Cloudinary (use signed URL — raw resources require auth delivery)
    const pdfResponse = await fetch(signedCloudinaryUrl(doc.documentUrl));
    if (!pdfResponse.ok) {
      return error(res, "Failed to fetch original document", 502);
    }
    const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());

    // Convert base64 PNG to Buffer
    const base64Data = signatureDataUrl.replace("data:image/png;base64,", "");
    const sigBuffer = Buffer.from(base64Data, "base64");

    // Use pdf-lib to stamp signature and optional name/date on last page
    console.log("signDocument: loading PDF bytes, length=", pdfBytes.length);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    console.log("signDocument: embedding signature PNG, length=", sigBuffer.length);
    const sigImage = await pdfDoc.embedPng(sigBuffer);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width: pdfW, height: pdfH } = lastPage.getSize();

    // Size: use the canvas display proportions sent from the frontend so the
    // final PDF exactly matches what the user saw on the positioning canvas.
    // Fall back to image-based sizing for old clients that don't send these fields.
    let sigWidth: number;
    let sigHeight: number;
    if (canvasW && sigDisplayW && sigDisplayH) {
      const scaleRatio = pdfW / canvasW;
      sigWidth  = sigDisplayW * (sigScale ?? 1) * scaleRatio;
      sigHeight = sigDisplayH * (sigScale ?? 1) * scaleRatio;
    } else {
      const intrinsic = sigImage.scale(1);
      sigWidth  = Math.min(220, pdfW * 0.32) * (sigScale ?? 1);
      sigHeight = intrinsic.width > 0
        ? (intrinsic.height / intrinsic.width) * sigWidth
        : sigWidth * 0.4;
    }

    // Position: convert top-left-origin screen fractions to bottom-left-origin PDF coords
    // Default falls back to bottom-right corner if no position was sent
    const sigX = sigPos
      ? Math.max(0, sigPos.xPct * pdfW)
      : pdfW - sigWidth - 30;
    const sigY = sigPos
      ? Math.max(0, pdfH * (1 - sigPos.yPct) - sigHeight)
      : 30;

    lastPage.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    // Draw name and date text if provided — wrapped so a font error never breaks signing
    if ((nameText && nameText.trim()) || dateText) {
      try {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        // TEXT_BOX_H=26px on canvas; baseline sits ~70% down the box → offset = 18 * scaleRatio
        const textScaleRatio = canvasW ? pdfW / canvasW : 1;
        const textYOffset = 18 * textScaleRatio;

        if (nameText && nameText.trim() && namePos) {
          lastPage.drawText(nameText.trim(), {
            x: Math.max(0, namePos.xPct * pdfW),
            y: Math.max(0, pdfH * (1 - namePos.yPct) - textYOffset),
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
        }

        if (dateText && datePos) {
          // Locale-safe date format — avoids ICU availability issues in some Node builds
          const d = new Date(dateText + "T00:00:00");
          const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const formatted = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
          lastPage.drawText(formatted, {
            x: Math.max(0, datePos.xPct * pdfW),
            y: Math.max(0, pdfH * (1 - datePos.yPct) - textYOffset),
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
        }
      } catch (fontErr) {
        console.error("signDocument: text drawing failed (non-fatal):", fontErr);
      }
    }

    const signedPdfBytes = await pdfDoc.save();

    // Upload signed PDF to Cloudinary
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "alvarado/signed-documents",
            resource_type: "raw",
            public_id: `signed_${id}_${Date.now()}.pdf`,
          },
          (err, result) => {
            if (err || !result) reject(err || new Error("Upload failed"));
            else resolve(result as { secure_url: string });
          },
        )
        .end(Buffer.from(signedPdfBytes));
    });

    const signedDocumentUrl = uploadResult.secure_url;

    // Update record
    const updated = await prisma.documentSigningRequest.update({
      where: { id },
      data: {
        status: "signed",
        signedDocumentUrl,
        signatureImageUrl: signatureDataUrl,
        signedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        status: true,
        signedDocumentUrl: true,
        signedAt: true,
      },
    });

    return success(res, updated, "Document signed successfully");
  } catch (err) {
    console.error("signDocument error:", err);
    return error(res, "Failed to sign document", 500);
  }
}
