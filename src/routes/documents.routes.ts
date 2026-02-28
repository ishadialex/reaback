import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getUserDocuments, signDocument, downloadDocument } from "../controllers/documents.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getUserDocuments);
router.get("/:id/download", downloadDocument);
router.post("/:id/sign", signDocument);

export default router;
