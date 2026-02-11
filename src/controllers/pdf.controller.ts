import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import { env } from "../config/env.js";

interface VerifyPasscodeRequest {
  passcode: string;
}

/**
 * POST /api/pdf/verify-passcode
 * Verify PDF access passcode against multiple allowed passcodes
 */
export async function verifyPasscode(
  req: Request<{}, {}, VerifyPasscodeRequest>,
  res: Response
) {
  try {
    const { passcode } = req.body;

    // Validate request
    if (!passcode || typeof passcode !== "string") {
      return error(res, "Passcode is required", 400);
    }

    // Get passcodes from environment variable (comma-separated)
    const passcodesString = env.PDF_ACCESS_PASSCODES;

    if (!passcodesString) {
      console.error("PDF_ACCESS_PASSCODES not set in environment variables");
      return error(res, "PDF access is not configured on this server", 500);
    }

    // Split passcodes by comma and trim whitespace
    let allowedPasscodes = passcodesString
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code.length > 0); // Remove empty strings

    // Limit to 10 passcodes maximum
    if (allowedPasscodes.length > 10) {
      console.warn(
        `Warning: More than 10 passcodes configured. Only using first 10.`
      );
      allowedPasscodes = allowedPasscodes.slice(0, 10);
    }

    if (allowedPasscodes.length === 0) {
      console.error("No valid passcodes found in PDF_ACCESS_PASSCODES");
      return error(res, "PDF access is not configured on this server", 500);
    }

    console.log(
      `🔐 Checking PDF passcode against ${allowedPasscodes.length} configured passcode(s)`
    );

    // Verify passcode matches any of the allowed passcodes
    if (allowedPasscodes.includes(passcode)) {
      console.log(`✅ Valid PDF passcode provided`);
      return success(res, null, "Access granted");
    } else {
      console.log(`❌ Invalid PDF passcode attempt`);
      return error(res, "Invalid passcode", 401);
    }
  } catch (err) {
    console.error("Error verifying PDF passcode:", err);
    return error(res, "An error occurred while verifying passcode", 500);
  }
}
