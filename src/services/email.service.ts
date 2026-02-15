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
        .button-table {
          margin: 20px auto;
        }
        .button-cell {
          background: #667eea;
          border-radius: 6px;
          text-align: center;
        }
        .button-link {
          display: inline-block;
          background: #667eea;
          color: #ffffff !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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

          <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="button-table" width="100%">
            <tr>
              <td align="center">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="button-cell" style="border-radius: 6px; background: #667eea;">
                      <a href="${resetUrl}" target="_blank" class="button-link" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Your Password</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

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

/**
 * Send KYC approved email notification
 * @param email - Recipient email address
 * @param firstName - User's first name
 */
export async function sendKYCApprovedEmail(email: string, firstName: string) {
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
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0 0 8px 0;
          font-size: 26px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          font-size: 15px;
          opacity: 0.9;
        }
        .checkmark {
          width: 64px;
          height: 64px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 32px;
        }
        .content {
          padding: 40px 30px;
        }
        .success-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-left: 4px solid #22c55e;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
        }
        .success-box h3 {
          margin: 0 0 8px 0;
          color: #15803d;
          font-size: 16px;
        }
        .success-box p {
          margin: 0;
          color: #166534;
          font-size: 14px;
        }
        .features {
          margin: 24px 0;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .feature-icon {
          color: #22c55e;
          font-size: 18px;
          margin-right: 12px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .cta-button {
          display: block;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 30px 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          font-size: 13px;
          color: #666;
          border-top: 1px solid #dee2e6;
        }
        .footer a {
          color: #22c55e;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="checkmark">✅</div>
          <h1>KYC Verification Approved!</h1>
          <p>Your identity has been successfully verified</p>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>Great news! Your identity verification (KYC) has been reviewed and <strong>approved</strong>. You now have full access to all investment features on Alvarado.</p>

          <div class="success-box">
            <h3>✔ Verified Account</h3>
            <p>Your account is now fully verified and you can start investing immediately.</p>
          </div>

          <div class="features">
            <p><strong>What you can now do:</strong></p>
            <div class="feature-item">
              <span class="feature-icon">💼</span>
              <span>Browse and invest in available properties</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">💰</span>
              <span>Add funds and start earning returns</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <span>Track your investment portfolio and performance</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🏡</span>
              <span>Access exclusive pooled and individual investment opportunities</span>
            </div>
          </div>

          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="cta-button">
            Go to My Dashboard
          </a>

          <p style="font-size: 14px; color: #666;">If you have any questions, our support team is here to help.</p>
          <p>Best regards,<br><strong>The Alvarado Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>Need help? Contact us at <a href="mailto:support@alvarado.com">support@alvarado.com</a></p>
          <p>&copy; ${new Date().getFullYear()} Alvarado. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${firstName},

Great news! Your KYC (identity verification) has been approved.

Your Alvarado account is now fully verified. You can now:
- Browse and invest in available properties
- Add funds and start earning returns
- Track your investment portfolio
- Access exclusive investment opportunities

Visit your dashboard to get started: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard

Best regards,
The Alvarado Team
---
This is an automated message. Please do not reply.
Need help? Contact us at support@alvarado.com
  `;

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: "Your KYC Verification Has Been Approved ✅ - Alvarado",
      text: textContent,
      html: htmlContent,
    });
    console.log(`✅ KYC approval email sent to ${email}: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send KYC approval email to ${email}:`, err);
    // Don't throw - email failure shouldn't block the approval
  }
}

/**
 * Send KYC rejected email notification
 * @param email - Recipient email address
 * @param firstName - User's first name
 * @param rejectionReason - Reason for rejection
 */
export async function sendKYCRejectedEmail(email: string, firstName: string, rejectionReason: string) {
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
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0 0 8px 0;
          font-size: 26px;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          font-size: 15px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .reason-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-left: 4px solid #ef4444;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
        }
        .reason-box h3 {
          margin: 0 0 8px 0;
          color: #b91c1c;
          font-size: 15px;
        }
        .reason-box p {
          margin: 0;
          color: #7f1d1d;
          font-size: 14px;
        }
        .steps {
          margin: 24px 0;
        }
        .step-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .step-num {
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .cta-button {
          display: block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          text-align: center;
          margin: 30px 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          font-size: 13px;
          color: #666;
          border-top: 1px solid #dee2e6;
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
          <h1>❌ KYC Verification Unsuccessful</h1>
          <p>Your identity verification requires attention</p>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>We've reviewed your identity verification (KYC) submission and unfortunately it could not be approved at this time.</p>

          <div class="reason-box">
            <h3>Reason for rejection:</h3>
            <p>${rejectionReason}</p>
          </div>

          <div class="steps">
            <p><strong>What to do next:</strong></p>
            <div class="step-item">
              <div class="step-num">1</div>
              <span>Review the rejection reason above carefully</span>
            </div>
            <div class="step-item">
              <div class="step-num">2</div>
              <span>Prepare the correct documents (ensure they are clear, valid, and not expired)</span>
            </div>
            <div class="step-item">
              <div class="step-num">3</div>
              <span>Re-submit your KYC documents from your dashboard</span>
            </div>
          </div>

          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/security/kyc" class="cta-button">
            Re-submit KYC Documents
          </a>

          <p style="font-size: 14px; color: #666;">If you believe this was a mistake or need assistance, please contact our support team.</p>
          <p>Best regards,<br><strong>The Alvarado Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>Need help? Contact us at <a href="mailto:support@alvarado.com">support@alvarado.com</a></p>
          <p>&copy; ${new Date().getFullYear()} Alvarado. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${firstName},

Your KYC (identity verification) submission was not approved.

Reason: ${rejectionReason}

What to do next:
1. Review the rejection reason above
2. Prepare the correct, valid documents
3. Re-submit from your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/security/kyc

If you need help, contact us at support@alvarado.com

Best regards,
The Alvarado Team
---
This is an automated message. Please do not reply.
  `;

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: "KYC Verification Update - Action Required - Alvarado",
      text: textContent,
      html: htmlContent,
    });
    console.log(`✅ KYC rejection email sent to ${email}: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send KYC rejection email to ${email}:`, err);
    // Don't throw - email failure shouldn't block the rejection
  }
}
