import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";

// Check if Cloudinary is configured
const isCloudinaryConfigured = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

// Create storage configurations only if Cloudinary is configured
const profileStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "alvarado/profiles",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 400, height: 400, crop: "fill" }],
      } as any,
    })
  : multer.memoryStorage();

const propertyStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "alvarado/properties",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 1200, height: 800, crop: "limit" }],
      } as any,
    })
  : multer.memoryStorage();

const attachmentStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "alvarado/attachments",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "pdf"],
        resource_type: "auto",
      } as any,
    })
  : multer.memoryStorage();

const teamStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "alvarado/team",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face" }],
      } as any,
    })
  : multer.memoryStorage();

const kycStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "alvarado/kyc-documents",
        allowed_formats: ["jpg", "jpeg", "png", "pdf"],
        resource_type: "auto",
      } as any,
    })
  : multer.memoryStorage();

export const uploadTeamImage = multer({
  storage: teamStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("image");

export const uploadSingle = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("file");

export const uploadMultiple = multer({
  storage: propertyStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
}).array("images", 20);

// Upload property images + manager photo
export const uploadPropertyWithManager = multer({
  storage: propertyStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
}).fields([
  { name: "images", maxCount: 20 },
  { name: "managerPhoto", maxCount: 1 },
]);

export const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("file");

export const uploadKYCDocument = multer({
  storage: kycStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("file");
