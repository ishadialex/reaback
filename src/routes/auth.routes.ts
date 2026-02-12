import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema, verifyOtpSchema, resendOtpSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema } from "../validators/auth.schema.js";
import { register, login, forceLogin, validateSession, verifyOtp, resendOtp, forgotPassword, resetPassword, refreshToken, logout, exchangeOAuthToken } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/force-login", validate(loginSchema), forceLogin);
router.post("/validate-session", validateSession);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);
router.post("/resend-otp", validate(resendOtpSchema), resendOtp);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", validate(refreshTokenSchema), logout);
router.post("/exchange-oauth-token", exchangeOAuthToken);

export default router;
