import { Router } from "express";
import monitorRoutes from "./monitor.routes.js";
import publicRoutes from "./public.routes.js";
import authRoutes from "./auth.routes.js";
import oauthRoutes from "./oauth.routes.js";
import profileRoutes from "./profile.routes.js";
import settingsRoutes from "./settings.routes.js";
import sessionsRoutes from "./sessions.routes.js";
import twoFactorRoutes from "./twoFactor.routes.js";
import supportRoutes from "./support.routes.js";
import transferRoutes from "./transfer.routes.js";
import transactionsRoutes from "./transactions.routes.js";
import investmentsRoutes from "./investments.routes.js";
import propertiesRoutes from "./properties.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import referralRoutes from "./referral.routes.js";
import fundRoutes from "./fund.routes.js";
import paymentMethodsRoutes from "./paymentMethods.routes.js";
import fundOperationsRoutes from "./fundOperations.routes.js";
import adminTeamRoutes from "./admin/team.routes.js";
import adminTestimonialsRoutes from "./admin/testimonials.routes.js";
import adminInvestmentsRoutes from "./admin/investments.routes.js";
import adminPropertiesRoutes from "./admin/properties.routes.js";
import adminUsersRoutes from "./admin/users.routes.js";

const router = Router();

// Monitoring routes
router.use("/", monitorRoutes);

// Public routes (no auth)
router.use("/public", publicRoutes);

// Auth routes
router.use("/auth", authRoutes);
router.use("/auth", oauthRoutes);

// User routes (JWT required)
router.use("/profile", profileRoutes);
router.use("/settings", settingsRoutes);
router.use("/sessions", sessionsRoutes);
router.use("/2fa", twoFactorRoutes);
router.use("/support", supportRoutes);
router.use("/transfers", transferRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/investments", investmentsRoutes);
router.use("/properties", propertiesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/referrals", referralRoutes);
router.use("/fund", fundRoutes);
router.use("/payment-methods", paymentMethodsRoutes);
router.use("/fund-operations", fundOperationsRoutes);

// Admin routes (API key OR admin role required)
router.use("/admin/team", adminTeamRoutes);
router.use("/admin/testimonials", adminTestimonialsRoutes);
router.use("/admin/investments", adminInvestmentsRoutes);
router.use("/admin/properties", adminPropertiesRoutes);
router.use("/admin/users", adminUsersRoutes);

export default router;
