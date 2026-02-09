import { transporter, emailConfig } from "../config/email.js";

/**
 * Send OTP verification email
 * @param email - Recipient email address
 * @param code - 6-digit OTP code
 * @param firstName - User's first name for personalization
 * @returns Promise that resolves when email is sent
 */
export async function sendOtpEmail(email: string, code: string, firstName: string) {

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .otp-box {
          background: #f8f9fa;
          border: 2px dashed #667eea;
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-code {
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #667eea;
          font-family: 'Courier New', monospace;
        }
        .otp-label {
          font-size: 14px;
          color: #666;
          margin-top: 10px;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning-text {
          margin: 0;
          font-size: 14px;
          color: #856404;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          font-size: 14px;
          color: #666;
          border-top: 1px solid #dee2e6;
        }
        .footer p {
          margin: 5px 0;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello ${firstName},</p>
          <p>Thank you for registering with Alvarado! To complete your registration, please verify your email address using the code below:</p>

          <div class="otp-box">
            <div class="otp-code">${code}</div>
            <div class="otp-label">Your Verification Code</div>
          </div>

          <p>Enter this code in the verification page to activate your account.</p>

          <div class="warning">
            <p class="warning-text">
              ⏱️ <strong>This code will expire in 10 minutes.</strong> If you don't use it within this time, you'll need to request a new code.
            </p>
          </div>

          <p>If you didn't create an account with Alvarado, please ignore this email or contact our support team if you have concerns.</p>
        </div>
        <div class="footer">
          <p><strong>Alvarado</strong></p>
          <p>This is an automated message, please do not reply.</p>
          <p>Need help? Contact us at <a href="mailto:support@alvarado.com">support@alvarado.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${firstName},

Thank you for registering with Alvarado!

Your email verification code is: ${code}

This code will expire in 10 minutes.

Enter this code in the verification page to activate your account.

If you didn't create an account with Alvarado, please ignore this email.

---
Alvarado
This is an automated message, please do not reply.
Need help? Contact us at support@alvarado.com
  `;

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: "Verify Your Email Address - Alvarado",
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}:`, error);
    throw new Error("Failed to send verification email");
  }
}

/**
 * Send welcome email after successful verification (optional)
 * @param email - Recipient email address
 * @param firstName - User's first name
 */
export async function sendWelcomeEmail(email: string, firstName: string) {

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 8px;
          padding: 40px;
        }
        h1 {
          color: #667eea;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Alvarado! 🎉</h1>
        <p>Hi ${firstName},</p>
        <p>Your email has been successfully verified! You can now enjoy full access to your account.</p>
        <p>Get started by exploring our investment opportunities and managing your portfolio.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Alvarado Team</p>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: "Welcome to Alvarado!",
      html: htmlContent,
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error);
    // Don't throw error for welcome email - it's not critical
  }
}

/**
 * Send password reset email with reset link
 * @param email - Recipient email address
 * @param firstName - User's first name
 * @param resetToken - Unique reset token
 * @param resetUrl - Full password reset URL
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetUrl: string
) {

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .content {
          padding: 40px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 12px;
          background: #f8f9fa;
        }
        .token-box {
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          padding: 15px;
          margin: 20px 0;
          border-radius: 6px;
          font-family: monospace;
          font-size: 14px;
          text-align: center;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password for your Alvarado account. Click the button below to create a new password:</p>

          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Your Password</a>
          </div>

          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <div class="token-box">${resetUrl}</div>

          <div class="warning">
            <strong>⚠️ Important:</strong>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>This link will expire in <strong>1 hour</strong></li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Your password won't change until you create a new one</li>
            </ul>
          </div>

          <p style="margin-top: 30px;">If you're having trouble with the button above, contact our support team for assistance.</p>

          <p>Best regards,<br><strong>The Alvarado Security Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Alvarado. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: emailConfig.from,
    to: email,
    subject: "Reset Your Password - Alvarado",
    html: htmlContent,
  });

  console.log(`✅ Password reset email sent to ${email}`);
}
