import { Router, Request, Response, NextFunction } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import { uploadPropertyWithManager } from "../../middleware/upload.js";
import { getAll, getOne, create, update, remove, hardDelete, removeImage } from "../../controllers/admin/properties.controller.js";

const router = Router();

router.use(adminAuthFlexible);

// Wrap multer to catch Cloudinary upload errors.
// Skip multer entirely for non-multipart requests (e.g. JSON PATCH for field-only updates).
function handleUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return next();
  }
  uploadPropertyWithManager(req, res, (err: any) => {
    if (err) {
      // ECONNRESET / aborted = client disconnected; nothing to respond to
      if (err.code === "ECONNRESET" || err.message === "aborted") return;
      console.error("Image upload error:", err);
      if (!res.headersSent) {
        return res.status(400).json({
          success: false,
          message: err.message || "Image upload failed",
        });
      }
      return;
    }
    next();
  });
}

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", handleUpload, create);
router.patch("/:id", handleUpload, update);
router.delete("/:id/images", removeImage);
router.delete("/:id", remove);
router.delete("/:id/permanent", hardDelete);

export default router;
