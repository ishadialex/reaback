import { Router, Request, Response, NextFunction } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import { uploadPropertyWithManager } from "../../middleware/upload.js";
import { getAll, getOne, create, update, remove, hardDelete, removeImage } from "../../controllers/admin/properties.controller.js";

const router = Router();

router.use(adminAuthFlexible);

// Wrap multer to catch Cloudinary upload errors
function handleUpload(req: Request, res: Response, next: NextFunction) {
  uploadPropertyWithManager(req, res, (err: any) => {
    if (err) {
      console.error("Image upload error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Image upload failed",
      });
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
