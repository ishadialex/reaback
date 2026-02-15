import { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { generateOtp, createOtp, verifyOtpCode } from "../utils/otp.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../services/email.service.js";
import { sendLoginAlert, sendReferralSuccessNotification, sendWelcomeBonusNotification, notifyAdminNewUserSignup, notifyAdminUserSignin } from "../services/notification.service.js";
import { getLocationString } from "../services/geolocation.service.js";
import { env } from "../config/env.js";
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies, getRefreshTokenFromCookies } from "../utils/cookies.js";
import { verify2FACode } from "./twoFactor.controller.js";

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex"); // 8 hex chars
}

function parseUserAgent(ua: string | undefined): { device: string; browser: string } {
  if (!ua) return { device: "Unknown", browser: "Unknown" };

  let browser = "Unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  let device = "Desktop";
  if (ua.includes("Mobile")) device = "Mobile";
  else if (ua.includes("Tablet")) device = "Tablet";

  return { device, browser };
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, firstName, lastName, phone, referralCode: providedReferralCode } = req.body;

    // Normalize email to lowercase for case-insensitive lookups
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return error(res, "An account with this email already exists", 409);
    }

    // Check if a referral code was provided and find the referrer
    let referrer = null;
    if (providedReferralCode) {
      referrer = await prisma.user.findUnique({
        where: { referralCode: providedReferralCode },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      if (!referrer) {
        return error(res, "Invalid referral code", 400);
      }
    }

    const passwordHash = await hashPassword(password);
    const userReferralCode = generateReferralCode();

    // Create user with Account for email/password authentication
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        phone,
        referralCode: userReferralCode,
        referredById: referrer?.id || null,
        emailVerified: false, // Explicitly set to false
        accounts: {
          create: {
            provider: "credentials",
            providerId: null,
            passwordHash,
          },
        },
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        referralCode: true,
        createdAt: true,
      },
    });

    // Generate 6-digit OTP
    const otpCode = generateOtp();

    // Store OTP in database with 10-minute expiry
    await createOtp(normalizedEmail, otpCode);

    // Send OTP via email
    try {
      await sendOtpEmail(normalizedEmail, otpCode, firstName);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // User is created, they can request resend later
    }

    // Return success WITHOUT tokens (user must verify email first)
    return success(
      res,
      {
        email: user.email,
        message: "Please check your email for the verification code",
      },
      "Registration successful. Please check your email for the verification code.",
      201
    );
  } catch (err) {
    console.error("register error:", err);
    return error(res, "Registration failed", 500);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Normalize email to lowercase for case-insensitive lookups
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`🔐 Login attempt: ${normalizedEmail}`);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        emailVerified: true,
        profilePhoto: true,
        twoFactorEnabled: true,
        requireTwoFactorLogin: true,
        accounts: {
          where: { provider: "credentials" },
          select: { passwordHash: true },
        },
      },
    });

    if (!user) {
      console.log(`❌ Login failed: User not found - ${normalizedEmail}`);
      return error(res, "Invalid email or password", 401);
    }

    if (!user.isActive) {
      console.log(`❌ Login failed: Account inactive - ${normalizedEmail}`);
      return error(res, "Invalid email or password", 401);
    }

    // Check if user has credentials account
    const credentialsAccount = user.accounts[0];
    if (!credentialsAccount || !credentialsAccount.passwordHash) {
      console.log(`❌ Login failed: No credentials account - ${normalizedEmail} (try Google Sign-In)`);
      return error(res, "Please sign in using Google", 401);
    }

    const valid = await comparePassword(password, credentialsAccount.passwordHash);
    if (!valid) {
      console.log(`❌ Login failed: Incorrect password - ${normalizedEmail}`);
      return error(res, "Invalid email or password", 401);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      console.log(`❌ Login failed: Email not verified - ${normalizedEmail}`);
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
        requiresVerification: true,
        email: normalizedEmail,
      });
    }

    // Check if 2FA is required for login
    if (user.requireTwoFactorLogin && user.twoFactorEnabled) {
      console.log(`🔐 2FA required for login: ${normalizedEmail}`);
      return res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        message: "Two-factor authentication code required",
        email: normalizedEmail,
      });
    }

    // Check for existing active sessions (Single-Device Login Security)
    const existingSessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        device: true,
        browser: true,
        location: true,
        lastActive: true,
        createdAt: true,
      },
      orderBy: { lastActive: "desc" },
    });

    const { device, browser } = parseUserAgent(req.headers["user-agent"]);
    const ipAddress = req.ip || "";
    const location = await getLocationString(ipAddress);

    let isNewDevice = true;

    // If active session exists, check if it's from the same device
    if (existingSessions.length > 0) {
      const sameDeviceSession = existingSessions.find(
        (s) => s.device === device && s.browser === browser
      );

      if (sameDeviceSession) {
        // Same device re-login — silently invalidate old session and continue
        await prisma.session.updateMany({
          where: { userId: user.id, isActive: true },
          data: { isActive: false },
        });
        isNewDevice = false;
        console.log(`🔄 Same-device re-login for ${normalizedEmail}, refreshing session`);
      } else {
        // Genuinely different device — warn the user
        console.log(`⚠️ Login attempt: Active session from different device for ${normalizedEmail}`);
        const mostRecentSession = existingSessions[0];

        return res.status(409).json({
          success: false,
          requiresForceLogin: true,
          message: "You are already logged in on another device",
          existingSession: {
            device: mostRecentSession.device,
            browser: mostRecentSession.browser,
            location: mostRecentSession.location,
            lastActive: mostRecentSession.lastActive,
          },
          newDevice: {
            device,
            browser,
            location,
          },
        });
      }
    }

    // Generate tokens with user profile data
    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || undefined;

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        device,
        browser,
        ipAddress,
        location,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Send login alert for all successful logins
    setImmediate(() => {
      sendLoginAlert(user.id, user.email, device, browser, location, ipAddress).catch(() => {});
    });

    // Notify admin about user signin
    setImmediate(() => {
      notifyAdminUserSignin(
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.id,
        device,
        browser,
        location,
        ipAddress
      ).catch((err) => console.error("Error sending admin signin notification:", err));
    });

    console.log(`✅ Login successful: ${normalizedEmail} from ${location}`);

    // Set tokens as httpOnly cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return success(res, {
      user,
      // Tokens are now in httpOnly cookies, not in response
    });
  } catch (err) {
    console.error("login error:", err);
    return error(res, "Login failed", 500);
  }
}

export async function forceLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Normalize email to lowercase for case-insensitive lookups
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`🔐 Force login attempt: ${normalizedEmail}`);

    // Re-verify credentials (SECURITY: always verify password for force login)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        emailVerified: true,
        profilePhoto: true,
        twoFactorEnabled: true,
        requireTwoFactorLogin: true,
        accounts: {
          where: { provider: "credentials" },
          select: { passwordHash: true },
        },
      },
    });

    if (!user) {
      console.log(`❌ Force login failed: User not found - ${normalizedEmail}`);
      return error(res, "Invalid email or password", 401);
    }

    if (!user.isActive) {
      console.log(`❌ Force login failed: Account inactive - ${normalizedEmail}`);
      return error(res, "Invalid email or password", 401);
    }

    // Check if user has credentials account
    const credentialsAccount = user.accounts[0];
    if (!credentialsAccount || !credentialsAccount.passwordHash) {
      console.log(`❌ Force login failed: No credentials account - ${normalizedEmail}`);
      return error(res, "Please sign in using Google", 401);
    }

    const valid = await comparePassword(password, credentialsAccount.passwordHash);
    if (!valid) {
      console.log(`❌ Force login failed: Incorrect password - ${normalizedEmail}`);
      return error(res, "Invalid email or password", 401);
    }

    if (!user.emailVerified) {
      console.log(`❌ Force login failed: Email not verified - ${normalizedEmail}`);
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
        requiresVerification: true,
        email: normalizedEmail,
      });
    }

    // Check if 2FA is required for login
    if (user.requireTwoFactorLogin && user.twoFactorEnabled) {
      console.log(`🔐 2FA required for force login: ${normalizedEmail}`);
      return res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        requiresForceLogin: true,
        message: "Two-factor authentication code required",
        email: normalizedEmail,
      });
    }

    // Invalidate ALL existing active sessions (force logout from all devices)
    const invalidatedSessions = await prisma.session.updateMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`🚪 Force login: Invalidated ${invalidatedSessions.count} existing session(s) for ${normalizedEmail}`);

    // Get device info for new session
    const { device, browser } = parseUserAgent(req.headers["user-agent"]);
    const ipAddress = req.ip || "";
    const location = await getLocationString(ipAddress);

    // Create new session with user profile data
    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || undefined;

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        device,
        browser,
        ipAddress,
        location,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Send login alert (async, non-blocking)
    setImmediate(() => {
      sendLoginAlert(user.id, user.email, device, browser, location, ipAddress).catch(() => {});
    });

    // Notify admin about user signin
    setImmediate(() => {
      notifyAdminUserSignin(
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.id,
        device,
        browser,
        location,
        ipAddress
      ).catch((err) => console.error("Error sending admin signin notification:", err));
    });

    console.log(`✅ Force login successful: ${normalizedEmail} from ${location} (${invalidatedSessions.count} device(s) logged out)`);

    // Set tokens as httpOnly cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return success(res, {
      user,
      // Tokens are now in httpOnly cookies, not in response
      message: `Successfully logged in. ${invalidatedSessions.count} other session(s) have been logged out.`,
    });
  } catch (err) {
    console.error("forceLogin error:", err);
    return error(res, "Force login failed", 500);
  }
}

export async function verify2FALogin(req: Request, res: Response) {
  try {
    const { email, password, code, forceLogin: isForceLogin } = req.body;

    if (!email || !password || !code) {
      return error(res, "Email, password, and 2FA code are required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Re-verify credentials (never trust client-side state alone)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        emailVerified: true,
        profilePhoto: true,
        twoFactorEnabled: true,
        requireTwoFactorLogin: true,
        accounts: {
          where: { provider: "credentials" },
          select: { passwordHash: true },
        },
      },
    });

    if (!user || !user.isActive || !user.emailVerified) {
      return error(res, "Invalid email or password", 401);
    }

    const credentialsAccount = user.accounts[0];
    if (!credentialsAccount || !credentialsAccount.passwordHash) {
      return error(res, "Please sign in using Google", 401);
    }

    const valid = await comparePassword(password, credentialsAccount.passwordHash);
    if (!valid) {
      return error(res, "Invalid email or password", 401);
    }

    // Verify 2FA code
    const is2FAValid = await verify2FACode(user.id, code);
    if (!is2FAValid) {
      return error(res, "Invalid 2FA code. Please try again.", 401);
    }

    // If force login, invalidate all existing sessions
    if (isForceLogin) {
      await prisma.session.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    } else {
      // Check for existing active sessions (Single-Device Login Security)
      const { device, browser } = parseUserAgent(req.headers["user-agent"]);
      const existingSessions = await prisma.session.findMany({
        where: { userId: user.id, isActive: true },
        select: { id: true, device: true, browser: true, location: true, lastActive: true },
        orderBy: { lastActive: "desc" },
      });

      if (existingSessions.length > 0) {
        const sameDeviceSession = existingSessions.find(
          (s) => s.device === device && s.browser === browser
        );

        if (sameDeviceSession) {
          await prisma.session.updateMany({
            where: { userId: user.id, isActive: true },
            data: { isActive: false },
          });
        } else {
          const ipAddress = req.ip || "";
          const location = await getLocationString(ipAddress);
          const mostRecentSession = existingSessions[0];
          return res.status(409).json({
            success: false,
            requiresForceLogin: true,
            requiresTwoFactor: true,
            message: "You are already logged in on another device",
            existingSession: {
              device: mostRecentSession.device,
              browser: mostRecentSession.browser,
              location: mostRecentSession.location,
              lastActive: mostRecentSession.lastActive,
            },
            newDevice: { device, browser, location },
          });
        }
      }
    }

    // Generate tokens
    const { device, browser } = parseUserAgent(req.headers["user-agent"]);
    const ipAddress = req.ip || "";
    const location = await getLocationString(ipAddress);

    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || undefined;

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });
    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      name,
      picture: user.profilePhoto || undefined
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        device,
        browser,
        ipAddress,
        location,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setImmediate(() => {
      sendLoginAlert(user.id, user.email, device, browser, location, ipAddress).catch(() => {});
    });

    setImmediate(() => {
      notifyAdminUserSignin(
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.id,
        device,
        browser,
        location,
        ipAddress
      ).catch((err) => console.error("Error sending admin signin notification:", err));
    });

    console.log(`✅ 2FA login successful: ${normalizedEmail} from ${location}`);

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return success(res, { user });
  } catch (err) {
    console.error("verify2FALogin error:", err);
    return error(res, "2FA login failed", 500);
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    const { email, code } = req.body;

    // Normalize email to lowercase for case-insensitive lookups
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        phone: true,
        referralCode: true,
        profilePhoto: true,
        referredById: true,
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    // Check if already verified
    if (user.emailVerified) {
      return error(res, "Email is already verified. Please login.", 400);
    }

    // Verify OTP code
    const verification = await verifyOtpCode(normalizedEmail, code);

    if (!verification.success) {
      return error(res, verification.message, 400);
    }

    // Mark email as verified
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: true },
    });

    // Notify admin about new user signup
    console.log(`📧 Preparing to send admin signup notification for ${user.email}`);
    let referrer = null;
    if (user.referredById) {
      referrer = await prisma.user.findUnique({
        where: { id: user.referredById },
        select: { firstName: true, lastName: true, referralCode: true },
      });
    }

    setImmediate(() => {
      console.log(`📧 Calling notifyAdminNewUserSignup for ${user.email}`);
      notifyAdminNewUserSignup(
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.id,
        referrer?.referralCode,
        referrer ? `${referrer.firstName} ${referrer.lastName}` : undefined
      ).catch((err) => console.error("❌ Error sending admin signup notification:", err));
    });

    // Process referral bonus if user was referred
    if (user.referredById) {
      const REFERRAL_BONUS = 10; // $10 bonus for both referrer and new user

      try {
        await prisma.$transaction(async (tx) => {
          // Create referral record
          await tx.referral.create({
            data: {
              referrerId: user.referredById!,
              referredUserId: user.id,
              status: "completed",
              reward: REFERRAL_BONUS,
            },
          });

          // Credit referrer bonus
          await tx.user.update({
            where: { id: user.referredById! },
            data: { balance: { increment: REFERRAL_BONUS } },
          });

          // Create transaction for referrer
          await tx.transaction.create({
            data: {
              userId: user.referredById!,
              type: "referral",
              amount: REFERRAL_BONUS,
              status: "completed",
              description: `Referral bonus for inviting ${user.firstName} ${user.lastName}`,
            },
          });

          // Credit new user bonus
          await tx.user.update({
            where: { id: user.id },
            data: { balance: { increment: REFERRAL_BONUS } },
          });

          // Create transaction for new user
          await tx.transaction.create({
            data: {
              userId: user.id,
              type: "referral",
              amount: REFERRAL_BONUS,
              status: "completed",
              description: `Welcome bonus for joining via referral`,
            },
          });
        });

        console.log(`✅ Referral bonus credited: $${REFERRAL_BONUS} to both referrer and new user`);

        // Send notifications to both referrer and new user asynchronously
        const referrer = await prisma.user.findUnique({
          where: { id: user.referredById! },
          select: { email: true, firstName: true, lastName: true },
        });

        if (referrer) {
          // Notify referrer about earning bonus
          setImmediate(() => {
            sendReferralSuccessNotification(
              user.referredById!,
              referrer.email,
              `${user.firstName} ${user.lastName}`,
              REFERRAL_BONUS
            ).catch((err) => console.error("Error sending referral notification:", err));
          });

          // Notify new user about receiving welcome bonus
          setImmediate(() => {
            sendWelcomeBonusNotification(
              user.id,
              user.email,
              user.firstName,
              `${referrer.firstName} ${referrer.lastName}`,
              REFERRAL_BONUS
            ).catch((err) => console.error("Error sending welcome bonus notification:", err));
          });
        }
      } catch (refErr) {
        console.error("Error processing referral bonus:", refErr);
        // Don't fail verification if referral bonus fails
      }
    }

    // Parse user agent for session tracking
    const { device, browser } = parseUserAgent(req.headers["user-agent"]);

    // Generate tokens
    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email });

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        device,
        browser,
        ipAddress: req.ip || "",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Set tokens as httpOnly cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    // Return user data (tokens are in httpOnly cookies)
    return success(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        referralCode: user.referralCode,
        profilePhoto: user.profilePhoto,
        emailVerified: true,
      },
      // Tokens are now in httpOnly cookies, not in response
    }, "Email verified successfully");
  } catch (err) {
    console.error("verifyOtp error:", err);
    return error(res, "OTP verification failed", 500);
  }
}

export async function resendOtp(req: Request, res: Response) {
  try {
    const { email } = req.body;

    // Normalize email to lowercase for case-insensitive lookups
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        emailVerified: true,
      },
    });

    if (!user) {
      // Return generic success to avoid email enumeration
      return success(res, null, "If an account exists with this email, a new verification code has been sent.");
    }

    // Check if already verified
    if (user.emailVerified) {
      return error(res, "Email is already verified. Please login.", 400);
    }

    // Generate new OTP
    const otpCode = generateOtp();

    // Store new OTP (this will delete old ones)
    await createOtp(normalizedEmail, otpCode);

    // Send OTP via email
    try {
      await sendOtpEmail(normalizedEmail, otpCode, user.firstName);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      return error(res, "Failed to send verification email. Please try again.", 500);
    }

    return success(res, null, "A new verification code has been sent to your email.");
  } catch (err) {
    console.error("resendOtp error:", err);
    return error(res, "Failed to resend verification code", 500);
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, "Email is required", 400);
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user (but don't reveal if user exists)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    // Always return success to avoid email enumeration
    if (!user || !user.isActive) {
      console.log(`⚠️ Password reset requested for non-existent/inactive email: ${normalizedEmail}`);
      return success(res, null, "If that email exists, a reset link has been sent");
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Delete any existing password reset tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email: normalizedEmail },
    });

    // Store reset token with 1-hour expiry
    await prisma.passwordReset.create({
      data: {
        email: normalizedEmail,
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Generate reset URL
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Send password reset email
    try {
      await sendPasswordResetEmail(normalizedEmail, user.firstName, resetUrl);
      console.log(`✅ Password reset email sent to ${normalizedEmail}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Don't fail the request if email fails
    }

    return success(res, null, "If that email exists, a reset link has been sent");
  } catch (err) {
    console.error("forgotPassword error:", err);
    return error(res, "Request failed", 500);
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return error(res, "Token and new password are required", 400);
    }

    // Validate password strength (at least 8 characters)
    if (newPassword.length < 8) {
      return error(res, "Password must be at least 8 characters long", 400);
    }

    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return error(res, "Invalid or expired reset token", 400);
    }

    // Check if token has expired
    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordReset.delete({ where: { token } });
      return error(res, "Reset token has expired. Please request a new one.", 400);
    }

    // Check if token has already been used
    if (resetRecord.used) {
      return error(res, "Reset token has already been used", 400);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        accounts: {
          where: { provider: "credentials" },
          select: { id: true },
        },
      },
    });

    if (!user) {
      return error(res, "User not found", 404);
    }

    // Check if credentials account exists
    const credentialsAccount = user.accounts[0];

    if (credentialsAccount) {
      // Update existing credentials account
      await prisma.account.update({
        where: { id: credentialsAccount.id },
        data: { passwordHash: newPasswordHash },
      });
    } else {
      // Create new credentials account (for users who signed up with OAuth)
      await prisma.account.create({
        data: {
          userId: user.id,
          provider: "credentials",
          providerId: null,
          passwordHash: newPasswordHash,
        },
      });
      console.log(`🔗 Created credentials account for OAuth user: ${user.email}`);
    }

    // Mark token as used
    await prisma.passwordReset.update({
      where: { token },
      data: { used: true },
    });

    // Invalidate all existing sessions (force re-login with new password)
    await prisma.session.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });

    console.log(`✅ Password reset successful for ${user.email}`);

    return success(res, null, "Password has been reset successfully. Please login with your new password.");
  } catch (err) {
    console.error("resetPassword error:", err);
    return error(res, "Password reset failed", 500);
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    // Read refresh token from httpOnly cookie instead of body
    const token = getRefreshTokenFromCookies(req);

    if (!token) {
      return error(res, "Refresh token is required. Please login again.", 400);
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return error(res, "Invalid or expired refresh token", 401);
    }

    // Look up session by current token OR by previousToken (grace period)
    const GRACE_PERIOD_MS = 30 * 1000; // 30 seconds

    let session = await prisma.session.findUnique({
      where: { token },
    });

    // If not found by current token, check if it matches a recently rotated previousToken
    if (!session) {
      session = await prisma.session.findFirst({
        where: { previousToken: token },
      });

      if (session && session.isActive && session.tokenRotatedAt) {
        const elapsed = Date.now() - session.tokenRotatedAt.getTime();
        if (elapsed > GRACE_PERIOD_MS) {
          // Grace period expired — possible token reuse attack: invalidate session
          await prisma.session.update({
            where: { id: session.id },
            data: { isActive: false },
          });
          console.warn(`Token reuse detected after grace period for session ${session.id}. Session invalidated.`);
          return error(res, "Session has been revoked for security. Please login again.", 401);
        }

        // Within grace period — return fresh access token without rotating refresh token again
        const graceUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { firstName: true, lastName: true, profilePhoto: true },
        });

        const graceName = graceUser?.firstName && graceUser?.lastName
          ? `${graceUser.firstName} ${graceUser.lastName}`
          : graceUser?.firstName || graceUser?.lastName || undefined;

        const graceAccessToken = signAccessToken({
          userId: payload.userId,
          email: payload.email,
          name: graceName,
          picture: graceUser?.profilePhoto || undefined
        });

        // Reuse the already-rotated refresh token — don't rotate again
        setAccessTokenCookie(res, graceAccessToken);
        setRefreshTokenCookie(res, session.token);

        return success(res, {
          message: "Tokens refreshed successfully",
        });
      }
    }

    if (!session || !session.isActive) {
      return error(res, "Session not found or has been revoked", 401);
    }

    // Fetch current user profile data for token payload
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { firstName: true, lastName: true, profilePhoto: true },
    });

    const name = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.lastName || undefined;

    const newAccessToken = signAccessToken({
      userId: payload.userId,
      email: payload.email,
      name,
      picture: user?.profilePhoto || undefined
    });
    const newRefreshToken = signRefreshToken({
      userId: payload.userId,
      email: payload.email,
      name,
      picture: user?.profilePhoto || undefined
    });

    // Rotate token and store the old one for the grace period
    await prisma.session.update({
      where: { id: session.id },
      data: {
        previousToken: token,
        tokenRotatedAt: new Date(),
        token: newRefreshToken,
        lastActive: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set new tokens as httpOnly cookies
    setAccessTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return success(res, {
      message: "Tokens refreshed successfully",
    });
  } catch (err) {
    console.error("refreshToken error:", err);
    return error(res, "Token refresh failed", 500);
  }
}

export async function validateSession(req: Request, res: Response) {
  try {
    // Read refresh token from httpOnly cookie instead of body
    const token = getRefreshTokenFromCookies(req);

    if (!token) {
      return error(res, "No token provided", 401);
    }

    const session = await prisma.session.findUnique({
      where: { token },
      select: { isActive: true },
    });

    if (!session || !session.isActive) {
      return error(res, "Session has been revoked", 401);
    }

    return success(res, {
      valid: true,
      checkInterval: 5000, // Recommended polling interval in milliseconds (5 seconds)
    });
  } catch (err) {
    console.error("validateSession error:", err);
    return error(res, "Session validation failed", 500);
  }
}

export async function logout(req: Request, res: Response) {
  try {
    // Read refresh token from httpOnly cookie
    const token = getRefreshTokenFromCookies(req);

    if (token) {
      // Try to find and deactivate the session
      const session = await prisma.session.findUnique({
        where: { token },
      });

      if (session) {
        await prisma.session.update({
          where: { id: session.id },
          data: { isActive: false },
        });
        console.log(`✓ Logout successful for session ${session.id}`);
      } else {
        console.log(`⚠️ Logout called with non-existent or already logged out session`);
      }
    }

    // Clear all authentication cookies
    clearAuthCookies(res);

    // Always return success even if session doesn't exist
    // (idempotent operation - multiple logouts should not fail)
    return success(res, null, "Logged out successfully");
  } catch (err) {
    console.error("logout error:", err);
    return error(res, "Logout failed", 500);
  }
}

export async function exchangeOAuthToken(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return error(res, "Token is required", 400);
    }

    // Find the OAuth token in database
    const oAuthToken = await prisma.oAuthToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profilePhoto: true,
            referralCode: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!oAuthToken) {
      return error(res, "Invalid or expired token", 401);
    }

    // Check if token has expired
    if (new Date() > oAuthToken.expiresAt) {
      // Delete expired token
      await prisma.oAuthToken.delete({ where: { token } });
      return error(res, "Token has expired", 401);
    }

    // Set httpOnly cookies with the stored tokens
    setAccessTokenCookie(res, oAuthToken.accessToken);
    setRefreshTokenCookie(res, oAuthToken.refreshToken);

    // Delete the temporary token (one-time use)
    await prisma.oAuthToken.delete({ where: { token } });

    // Return user data
    return success(res, {
      user: oAuthToken.user,
    }, "Authentication successful");
  } catch (err) {
    console.error("exchangeOAuthToken error:", err);
    return error(res, "Token exchange failed", 500);
  }
}
