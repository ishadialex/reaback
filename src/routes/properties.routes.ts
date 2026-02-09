import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getProperties, getProperty, getFeatured } from "../controllers/properties.controller.js";

const router = Router();

router.use(authenticate);

router.get("/featured", getFeatured);
router.get("/", getProperties);
router.get("/:id", getProperty);

export default router;
