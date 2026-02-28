import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadSigningDocument } from "../../middleware/upload.js";
import {
  listDocuments,
  sendDocument,
  downloadDocument,
  deleteDocument,
} from "../../controllers/admin/documents.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "superadmin"));

router.get("/", listDocuments);
router.get("/:id/download", downloadDocument);
router.post("/send", uploadSigningDocument, sendDocument);
router.delete("/:id", deleteDocument);

export default router;
