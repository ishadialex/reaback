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
import { sendLoginAlert, sendReferralSuccessNotification, sendWelcomeBonusNotification } from "../services/notification.service.js";
import { getLocationString } from "../services/geolocation.service.js";
import { env } from "../config/env.js";

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

    // Create user with emailVerified: false (will be set to true after OTP verification)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        phone,
        referralCode: userReferralCode,
        referredById: referrer?.id || null,
        emailVerified: false, // Explicitly set to false
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
        passwordHash: true,
        isActive: true,
        emailVerified: true,
        profilePhoto: true,
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

    const valid = await comparePassword(password, user.passwordHash);
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

    const { passwordHash: _, ...userData } = user;

    console.log(`✅ Login successful: ${normalizedEmail} from ${location}`);

    return success(res, {
      user: userData,
      accessToken,
      refreshToken,
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
        passwordHash: true,
        isActive: true,
        emailVerified: true,
        profilePhoto: true,
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

    const valid = await comparePassword(password, user.passwordHash);
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

    const { passwordHash: _, ...userData } = user;

    console.log(`✅ Force login successful: ${normalizedEmail} from ${location} (${invalidatedSessions.count} device(s) logged out)`);

    return success(res, {
      user: userData,
      accessToken,
      refreshToken,
      message: `Successfully logged in. ${invalidatedSessions.count} other session(s) have been logged out.`,
    });
  } catch (err) {
    console.error("forceLogin error:", err);
    return error(res, "Force login failed", 500);
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

    // Return user data with tokens
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
      accessToken,
      refreshToken,
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

    // Update user password
    const user = await prisma.user.update({
      where: { email: resetRecord.email },
      data: { passwordHash: newPasswordHash },
      select: { id: true, email: true, firstName: true },
    });

    if (!user) {
      return error(res, "User not found", 404);
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
    const { refreshToken: token } = req.body;

    if (!token) {
      return error(res, "Refresh token is required", 400);
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return error(res, "Invalid or expired refresh token", 401);
    }

    const session = await prisma.session.findUnique({
      where: { token },
    });

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

    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newRefreshToken,
        lastActive: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return success(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("refreshToken error:", err);
    return error(res, "Token refresh failed", 500);
  }
}

export async function validateSession(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body;

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

    return success(res, { valid: true });
  } catch (err) {
    console.error("validateSession error:", err);
    return error(res, "Session validation failed", 500);
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return error(res, "Refresh token is required", 400);
    }

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

    // Always return success even if session doesn't exist
    // (idempotent operation - multiple logouts should not fail)
    return success(res, null, "Logged out successfully");
  } catch (err) {
    console.error("logout error:", err);
    return error(res, "Logout failed", 500);
  }
}
