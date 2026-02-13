import { Router } from "express";
import { submitContactForm } from "../controllers/contact.controller.js";

const router = Router();

/**
 * @route   POST /api/contact
 * @desc    Submit contact form
 * @access  Public
 */
router.post("/", submitContactForm);

export default router;
