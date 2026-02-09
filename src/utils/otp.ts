import { prisma } from "../config/database.js";

/**
 * Generate a 6-digit numeric OTP code
 * @returns 6-digit string (100000-999999)
 */
export function generateOtp(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/**
 * Store OTP in database with 10-minute expiry
 * @param email - User's email address
 * @param code - 6-digit OTP code
 * @returns Created OTP record
 */
export async function createOtp(email: string, code: string) {
  // Delete any existing OTPs for this email first
  await prisma.otp.deleteMany({ where: { email } });

  // Create new OTP with 10-minute expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return await prisma.otp.create({
    data: {
      email,
      code,
      expiresAt,
    },
  });
}

/**
 * Verify OTP code for given email
 * @param email - User's email address
 * @param code - OTP code to verify
 * @returns Object with success status and message
 */
export async function verifyOtpCode(email: string, code: string) {
  const otpRecord = await prisma.otp.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" }, // Get most recent OTP
  });

  // Check if OTP exists
  if (!otpRecord) {
    return {
      success: false,
      message: "Invalid or expired verification code",
    };
  }

  // Check if OTP has expired
  if (new Date() > otpRecord.expiresAt) {
    await prisma.otp.delete({ where: { id: otpRecord.id } });
    return {
      success: false,
      message: "Verification code has expired. Please request a new one.",
    };
  }

  // Check if too many attempts
  if (otpRecord.attempts >= 5) {
    await prisma.otp.delete({ where: { id: otpRecord.id } });
    return {
      success: false,
      message: "Too many failed attempts. Please request a new code.",
    };
  }

  // Check if code matches
  if (otpRecord.code !== code) {
    // Increment attempts
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { attempts: otpRecord.attempts + 1 },
    });

    const remainingAttempts = 5 - (otpRecord.attempts + 1);
    return {
      success: false,
      message: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
    };
  }

  // Code is valid - delete OTP after successful verification
  await prisma.otp.delete({ where: { id: otpRecord.id } });

  return {
    success: true,
    message: "Email verified successfully",
  };
}

/**
 * Delete all OTPs for a given email
 * @param email - User's email address
 */
export async function deleteOtp(email: string) {
  await prisma.otp.deleteMany({ where: { email } });
}

/**
 * Check if an OTP exists and is still valid for an email
 * @param email - User's email address
 * @returns Boolean indicating if valid OTP exists
 */
export async function hasValidOtp(email: string): Promise<boolean> {
  const otpRecord = await prisma.otp.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) return false;

  // Check if expired
  if (new Date() > otpRecord.expiresAt) {
    await prisma.otp.delete({ where: { id: otpRecord.id } });
    return false;
  }

  return true;
}
