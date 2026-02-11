import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { sendLoginAlert } from "../services/notification.service.js";
import { getLocationString } from "../services/geolocation.service.js";

const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

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

/**
 * Initiate Google OAuth flow
 * Redirects user to Google's consent screen
 */
export async function googleLogin(req: Request, res: Response) {
  try {
    const { referralCode } = req.query;

    // Store referral code in state parameter to preserve it through OAuth flow
    const state = referralCode ? JSON.stringify({ referralCode }) : undefined;

    const authorizeUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
    });

    return res.redirect(authorizeUrl);
  } catch (err) {
    console.error("Google OAuth initiation error:", err);
    return error(res, "Failed to initiate Google login", 500);
  }
}

/**
 * Handle Google OAuth callback
 * Exchanges authorization code for tokens, creates or finds user, generates JWT
 */
export async function googleCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.redirect(`${env.FRONTEND_URL}/signin?error=missing_code`);
    }

    // Extract referral code from state if present
    let referralCode: string | undefined;
    if (state && typeof state === "string") {
      try {
        const stateData = JSON.parse(state);
        referralCode = stateData.referralCode;
      } catch (e) {
        console.log("Could not parse state parameter");
      }
    }

    // Exchange authorization code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info from Google
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.redirect(`${env.FRONTEND_URL}/signin?error=invalid_token`);
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";
    const profilePhoto = payload.picture || null;
    const emailVerified = payload.email_verified || false;

    // 1. Check if Account exists with this Google ID (without include to avoid null errors)
    const account = await prisma.account.findFirst({
      where: {
        provider: "google",
        providerId: googleId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    let user;

    if (account) {
      // Try to fetch the associated user
      user = await prisma.user.findUnique({
        where: { id: account.userId },
      });

      if (user) {
        // ✅ Account exists with valid user - just log them in
        console.log(`✅ Google account found: ${email}`);

        // Only update profile photo if user doesn't have a custom uploaded photo
        // Custom photos are stored on cloud storage, not Google's CDN
        const hasCustomPhoto = user.profilePhoto && !user.profilePhoto.includes('googleusercontent.com');

        if (profilePhoto && !hasCustomPhoto && profilePhoto !== user.profilePhoto) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { profilePhoto, emailVerified: true },
          });
        }
      } else {
        // Clean up orphaned account (Account without User)
        console.log(`⚠️  Cleaning up orphaned Account for Google ID: ${googleId}`);
        await prisma.account.delete({ where: { id: account.id } });
      }
    }

    if (!user) {
      // 2. Check if User exists with this email
      user = await prisma.user.findUnique({
        where: { email },
        include: { accounts: true },
      });

      if (user) {
        // 🔗 User exists but no Google account - LINK IT
        await prisma.account.create({
          data: {
            userId: user.id,
            provider: "google",
            providerId: googleId,
          },
        });

        // Update profile photo if not set
        if (profilePhoto && !user.profilePhoto) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { profilePhoto, emailVerified: true },
          });
        }

        console.log(`🔗 Linked Google account to existing user: ${email}`);
      } else {
        // 🆕 Brand new user - create User + Google Account
        let referrer = null;
        if (referralCode) {
          referrer = await prisma.user.findUnique({
            where: { referralCode },
            select: { id: true, email: true, firstName: true, lastName: true },
          });
        }

        const userReferralCode = generateReferralCode();

        user = await prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            profilePhoto,
            emailVerified,
            referralCode: userReferralCode,
            referredById: referrer?.id || null,
            accounts: {
              create: {
                provider: "google",
                providerId: googleId,
              },
            },
            settings: {
              create: {},
            },
          },
        });

        console.log(`🆕 Created new user with Google account: ${email}`);

      // Process referral bonus if user was referred
      if (referrer) {
        const REFERRAL_BONUS = 10;

        try {
          await prisma.$transaction(async (tx) => {
            // Create referral record
            await tx.referral.create({
              data: {
                referrerId: referrer.id,
                referredUserId: user!.id,
                status: "completed",
                reward: REFERRAL_BONUS,
              },
            });

            // Credit referrer bonus
            await tx.user.update({
              where: { id: referrer.id },
              data: { balance: { increment: REFERRAL_BONUS } },
            });

            // Create transaction for referrer
            await tx.transaction.create({
              data: {
                userId: referrer.id,
                type: "referral",
                amount: REFERRAL_BONUS,
                status: "completed",
                description: `Referral bonus for inviting ${firstName} ${lastName}`,
              },
            });

            // Credit new user bonus
            await tx.user.update({
              where: { id: user!.id },
              data: { balance: { increment: REFERRAL_BONUS } },
            });

            // Create transaction for new user
            await tx.transaction.create({
              data: {
                userId: user!.id,
                type: "referral",
                amount: REFERRAL_BONUS,
                status: "completed",
                description: `Welcome bonus for joining via referral`,
              },
            });
          });

          console.log(`✅ Referral bonus credited: $${REFERRAL_BONUS} to both referrer and new user`);

          // Send notifications asynchronously (import notification service functions if needed)
          // Note: You may want to import and call sendReferralSuccessNotification and sendWelcomeBonusNotification here
        } catch (refErr) {
          console.error("Error processing referral bonus:", refErr);
        }
      }
      }
    }

    // Generate JWT tokens with profile data
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

    // Parse user agent and get location for session tracking
    const { device, browser } = parseUserAgent(req.headers["user-agent"]);
    const ipAddress = req.ip || "";
    const location = await getLocationString(ipAddress);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        device,
        browser,
        ipAddress,
        location,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Send login alert notification
    setImmediate(() => {
      sendLoginAlert(user.id, user.email, device, browser, location, ipAddress).catch(() => {});
    });

    // Redirect to frontend with tokens
    const redirectUrl = `${env.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return res.redirect(`${env.FRONTEND_URL}/signin?error=oauth_failed`);
  }
}
