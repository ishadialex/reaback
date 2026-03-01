import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadSigningDocument } from "../../middleware/upload.js";
import {
  listDocuments,
  sendDocument,
  downloadDocument,
  updateDocument,
  deleteDocument,
  adminSignDocument,
} from "../../controllers/admin/documents.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

// Only run multer when the request is multipart; skip for plain JSON PATCHes
function handleUploadDocument(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers["content-type"] || "";
  if (!ct.startsWith("multipart/form-data")) return next();
  uploadSigningDocument(req, res, (err: any) => {
    if (err) {
      if (err.code === "ECONNRESET" || err.message === "aborted") return;
      if (!res.headersSent)
        return res.status(400).json({ success: false, message: err.message || "Upload failed" });
      return;
    }
    next();
  });
}

router.get("/", listDocuments);
router.get("/:id/download", downloadDocument);
router.post("/send", uploadSigningDocument, sendDocument);
router.patch("/:id", handleUploadDocument, updateDocument);
router.post("/:id/admin-sign", adminSignDocument);
router.delete("/:id", deleteDocument);

export default router;
