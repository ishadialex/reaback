import { Router } from "express";
import { googleLogin, googleCallback } from "../controllers/oauth.controller.js";

const router = Router();

// Google OAuth routes
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);

export default router;
