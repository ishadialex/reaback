import { Router } from "express";
import { authLimiter, apiLimiter, publicLimiter } from "../middleware/rateLimit.js";
import monitorRoutes from "./monitor.routes.js";
import publicRoutes from "./public.routes.js";
import pdfRoutes from "./pdf.routes.js";
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
import bidRoutes from "./bid.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import referralRoutes from "./referral.routes.js";
import fundRoutes from "./fund.routes.js";
import paymentMethodsRoutes from "./paymentMethods.routes.js";
import fundOperationsRoutes from "./fundOperations.routes.js";
import newsletterRoutes from "./newsletter.routes.js";
import contactRoutes from "./contact.routes.js";
import reviewsRoutes from "./reviews.routes.js";
import adminTeamRoutes from "./admin/team.routes.js";
import adminTestimonialsRoutes from "./admin/testimonials.routes.js";
import adminInvestmentsRoutes from "./admin/investments.routes.js";
import adminPropertiesRoutes from "./admin/properties.routes.js";
import adminUsersRoutes from "./admin/users.routes.js";
import adminKycRoutes from "./admin/kyc.routes.js";
import adminFundOperationsRoutes from "./admin/fundOperations.routes.js";
import adminPaymentWalletsRoutes from "./admin/paymentWallets.routes.js";
import adminDocumentsRoutes from "./admin/documents.routes.js";
import adminSupportRoutes from "./admin/support.routes.js";
import adminForumRoutes from "./admin/forum.routes.js";
import adminReviewsRoutes from "./admin/reviews.routes.js";
import adminWhatsappRoutes from "./admin/whatsapp.routes.js";
import adminChatRoutes from "./admin/chat.routes.js";
import adminZillowRoutes from "./admin/zillow.routes.js";
import documentsRoutes from "./documents.routes.js";
import kycRoutes from "./kyc.routes.js";
import forumRoutes from "./forum.routes.js";
import chatRoutes from "./chat.routes.js";

const router = Router();

// Monitoring routes
router.use("/", monitorRoutes);

// Public routes (no auth)
router.use("/chat", publicLimiter, chatRoutes);
router.use("/public", publicLimiter, publicRoutes);
router.use("/pdf", publicLimiter, pdfRoutes);
router.use("/newsletter", publicLimiter, newsletterRoutes);
router.use("/contact", publicLimiter, contactRoutes);

// Auth routes
router.use("/auth", authLimiter, authRoutes);
router.use("/auth", authLimiter, oauthRoutes);

// User routes (JWT required)
router.use("/profile", apiLimiter, profileRoutes);
router.use("/settings", apiLimiter, settingsRoutes);
router.use("/sessions", apiLimiter, sessionsRoutes);
router.use("/2fa", apiLimiter, twoFactorRoutes);
router.use("/kyc", apiLimiter, kycRoutes);
router.use("/support", apiLimiter, supportRoutes);
router.use("/transfers", apiLimiter, transferRoutes);
router.use("/transactions", apiLimiter, transactionsRoutes);
router.use("/investments", apiLimiter, investmentsRoutes);
router.use("/properties", apiLimiter, propertiesRoutes);
router.use("/properties", apiLimiter, bidRoutes);
router.use("/notifications", apiLimiter, notificationsRoutes);
router.use("/referrals", apiLimiter, referralRoutes);
router.use("/fund", apiLimiter, fundRoutes);
router.use("/payment-methods", apiLimiter, paymentMethodsRoutes);
router.use("/fund-operations", apiLimiter, fundOperationsRoutes);
router.use("/reviews", apiLimiter, reviewsRoutes);
router.use("/documents", apiLimiter, documentsRoutes);
router.use("/forum", apiLimiter, forumRoutes);

// Admin routes (API key OR admin role required)
router.use("/admin/team", adminTeamRoutes);
router.use("/admin/testimonials", adminTestimonialsRoutes);
router.use("/admin/investments", adminInvestmentsRoutes);
router.use("/admin/properties", adminPropertiesRoutes);
router.use("/admin/users", adminUsersRoutes);
router.use("/admin/kyc", adminKycRoutes);
router.use("/admin/fund-operations", adminFundOperationsRoutes);
router.use("/admin/payment-wallets", adminPaymentWalletsRoutes);
router.use("/admin/documents", adminDocumentsRoutes);
router.use("/admin/support", adminSupportRoutes);
router.use("/admin/forum", adminForumRoutes);
router.use("/admin/reviews", adminReviewsRoutes);
router.use("/admin/whatsapp", adminWhatsappRoutes);
router.use("/admin/chat", adminChatRoutes);
router.use("/admin/zillow", adminZillowRoutes);

export default router;
