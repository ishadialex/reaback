import { transporter, emailConfig } from "../config/email.js";
import {
  emailWrapper,
  ctaButton,
  infoBox,
  warningBox,
  successBox,
  dangerBox,
  sectionHeading,
  paragraph,
  otpBox,
  bigAmount,
  BRAND_PRIMARY,
  escapeHtml,
} from "../utils/emailTemplate.js";

/**
 * Send OTP verification email
 */
export async function sendOtpEmail(email: string, code: string, firstName: string) {

  const body = `
    ${sectionHeading("Email Verification")}
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph("Thank you for registering with Alvarado. To complete your registration, please verify your email address using the one-time code below:")}
    ${otpBox(code)}
    ${warningBox(`<p style="margin:0; font-size:14px; color:#92400e;"><strong>⏱ This code expires in 10 minutes.</strong> If you didn't request this, please ignore this email or contact our support team.</p>`)}
    ${paragraph("Enter this code on the verification page to activate your account. Do not share this code with anyone.")}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const htmlContent = emailWrapper({
    preheader: `Your Alvarado verification code is: ${code}`,
    body,
  });

  const textContent = `
Hello ${firstName},

Your Alvarado email verification code is: ${code}

This code expires in 10 minutes.

If you didn't create an account, please ignore this email.

---
${emailConfig.appName}
This is an automated message. Do not reply.
Support: support@alvarado.com
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `${code} is your Alvarado verification code`,
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
 * Send welcome email after successful verification
 */
export async function sendWelcomeEmail(email: string, firstName: string) {

  const body = `
    ${sectionHeading("Welcome to Alvarado!")}
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph("Your email has been successfully verified. You now have full access to your Alvarado account and everything it has to offer.")}
    ${successBox(`
      <p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#15803d;">Your account is active and ready to go.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding:6px 0; font-size:14px; color:#166534;">&#10003;&nbsp; Browse and invest in curated properties</td></tr>
        <tr><td style="padding:6px 0; font-size:14px; color:#166534;">&#10003;&nbsp; Add funds and start earning returns</td></tr>
        <tr><td style="padding:6px 0; font-size:14px; color:#166534;">&#10003;&nbsp; Track your investment portfolio in real time</td></tr>
        <tr><td style="padding:6px 0; font-size:14px; color:#166534;">&#10003;&nbsp; Refer friends and earn exclusive bonuses</td></tr>
      </table>
    `)}
    ${ctaButton("Go to My Dashboard", `${emailConfig.appUrl}/dashboard`)}
    ${paragraph("If you have any questions, our support team is available to assist you at any time.")}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Warm regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Welcome to ${emailConfig.appName} — Your account is ready`,
      html: emailWrapper({ preheader: "Your Alvarado account is now active. Start investing today.", body }),
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error);
    // Don't throw — welcome email is not critical
  }
}

/**
 * Send password reset email with reset link
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetUrl: string
) {

  const body = `
    ${sectionHeading("Password Reset Request")}
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph("We received a request to reset the password for your Alvarado account. Click the button below to create a new password. If you did not request this, no action is needed.")}
    ${ctaButton("Reset My Password", resetUrl)}
    ${infoBox(`
      <p style="margin:0 0 8px; font-size:14px; color:#374151;"><strong>Having trouble with the button?</strong></p>
      <p style="margin:0 0 8px; font-size:13px; color:#6b7280;">Copy and paste the link below into your browser:</p>
      <p style="margin:0; font-size:12px; color:#4a6cf7; word-break:break-all; font-family:'Courier New',monospace;">${resetUrl}</p>
    `)}
    ${warningBox(`
      <p style="margin:0 0 4px; font-size:14px; color:#92400e;"><strong>Important security notes:</strong></p>
      <ul style="margin:8px 0 0; padding-left:18px; font-size:14px; color:#92400e;">
        <li style="margin-bottom:4px;">This link expires in <strong>1 hour</strong></li>
        <li style="margin-bottom:4px;">Your password will not change until you set a new one</li>
        <li>If you didn't request this, your account is safe — simply ignore this email</li>
      </ul>
    `)}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Security Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

We received a request to reset the password for your ${emailConfig.appName} account.

Reset your password using this link:
${resetUrl}

This link expires in 1 hour.

If you did not request a password reset, you can safely ignore this email.

---
${emailConfig.appName} Security Team
This is an automated message. Do not reply.
  `.trim();

  const sendPromise = transporter.sendMail({
    from: emailConfig.from,
    to: email,
    subject: `Reset your ${emailConfig.appName} password`,
    text: textContent,
    html: emailWrapper({ preheader: "Reset your Alvarado account password — link expires in 1 hour.", body }),
  });

  // 15-second timeout to prevent hanging
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Password reset email send timeout after 15s")), 15000)
  );

  await Promise.race([sendPromise, timeoutPromise]);

  console.log(`✅ Password reset email sent to ${email}`);
}

/**
 * Send KYC approved email notification
 */
export async function sendKYCApprovedEmail(email: string, firstName: string) {

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">&#10003;</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">KYC Verification Approved</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">Your identity has been successfully verified</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph("Excellent news! Your identity verification (KYC) has been reviewed and <strong>approved</strong>. Your Alvarado account is now fully verified and you have access to all investment features.")}
    ${successBox(`
      <p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#15803d;">What you can now do:</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#128188;&nbsp; Browse and invest in available properties</td></tr>
        <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#128176;&nbsp; Add funds and start earning returns</td></tr>
        <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#128202;&nbsp; Track your investment portfolio and performance</td></tr>
        <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#127968;&nbsp; Access exclusive pooled and individual opportunities</td></tr>
      </table>
    `)}
    ${ctaButton("Go to My Dashboard", `${emailConfig.appUrl}/dashboard`, "#16a34a")}
    ${paragraph("If you have any questions or need assistance, our support team is always happy to help.")}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

Your KYC (identity verification) has been approved.

Your Alvarado account is now fully verified. You can:
- Browse and invest in available properties
- Add funds and start earning returns
- Track your investment portfolio
- Access exclusive investment opportunities

Visit your dashboard: ${emailConfig.appUrl}/dashboard

Best regards,
${emailConfig.appName} Team
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Your KYC verification has been approved — ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({ preheader: "Your identity verification is approved. You can now invest on Alvarado.", body }),
    });
    console.log(`✅ KYC approval email sent to ${email}: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send KYC approval email to ${email}:`, err);
  }
}

/**
 * Send KYC rejected email notification
 */
export async function sendKYCRejectedEmail(email: string, firstName: string, rejectionReason: string) {
  const safeRejectionReason = escapeHtml(rejectionReason);

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">&#10007;</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">KYC Verification Unsuccessful</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">Your submission requires attention</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph("We have reviewed your identity verification (KYC) submission. Unfortunately, we were unable to approve it at this time.")}
    ${dangerBox(`
      <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#b91c1c;">Reason for rejection:</p>
      <p style="margin:0; font-size:14px; color:#7f1d1d;">${safeRejectionReason}</p>
    `)}
    ${infoBox(`
      <p style="margin:0 0 12px; font-size:14px; font-weight:600; color:#374151;">How to resubmit:</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#374151; vertical-align:top;">
            <span style="display:inline-block; width:22px; height:22px; border-radius:50%; background:${BRAND_PRIMARY}; color:#fff; text-align:center; line-height:22px; font-size:12px; font-weight:700; margin-right:10px;">1</span>
            Review the rejection reason above carefully
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#374151; vertical-align:top;">
            <span style="display:inline-block; width:22px; height:22px; border-radius:50%; background:${BRAND_PRIMARY}; color:#fff; text-align:center; line-height:22px; font-size:12px; font-weight:700; margin-right:10px;">2</span>
            Prepare clear, valid, and unexpired documents
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#374151; vertical-align:top;">
            <span style="display:inline-block; width:22px; height:22px; border-radius:50%; background:${BRAND_PRIMARY}; color:#fff; text-align:center; line-height:22px; font-size:12px; font-weight:700; margin-right:10px;">3</span>
            Re-submit your documents from your dashboard
          </td>
        </tr>
      </table>
    `)}
    ${ctaButton("Re-submit KYC Documents", `${emailConfig.appUrl}/dashboard/security/kyc`)}
    ${paragraph("If you believe this was a mistake or need assistance, please do not hesitate to contact our support team.")}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

Your KYC submission was not approved.

Reason: ${rejectionReason}

Next steps:
1. Review the rejection reason above
2. Prepare clear, valid, unexpired documents
3. Re-submit from your dashboard: ${emailConfig.appUrl}/dashboard/security/kyc

Need help? Contact us at support@alvarado.com

Best regards,
${emailConfig.appName} Team
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Action required: Your KYC verification needs attention — ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({ preheader: "Your KYC verification was not approved. Please review and resubmit.", body }),
    });
    console.log(`✅ KYC rejection email sent to ${email}: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send KYC rejection email to ${email}:`, err);
  }
}

/**
 * Send fund operation approved email (deposit or withdrawal)
 */
export async function sendFundOperationApprovedEmail(
  email: string,
  firstName: string,
  type: "deposit" | "withdrawal",
  amount: number,
  reference: string
) {
  const isDeposit = type === "deposit";
  const formattedAmount = `$${amount.toLocaleString()}`;

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">&#10003;</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">${isDeposit ? "Deposit Approved" : "Withdrawal Processed"}</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">${isDeposit ? "Funds have been credited to your account" : "Your withdrawal has been processed"}</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph(isDeposit
      ? `Great news! Your deposit request has been <strong>approved</strong> and the funds have been credited to your Alvarado account.`
      : `Your withdrawal request has been <strong>approved</strong> and is now being processed.`
    )}
    ${bigAmount(formattedAmount, "#16a34a")}
    ${successBox(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#6b7280; width:120px;">Type</td>
          <td style="padding:6px 0; font-size:14px; color:#1f2937; font-weight:500;">${isDeposit ? "Deposit" : "Withdrawal"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#6b7280;">Amount</td>
          <td style="padding:6px 0; font-size:14px; color:#1f2937; font-weight:500;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#6b7280;">Reference</td>
          <td style="padding:6px 0; font-size:14px; color:#1f2937; font-weight:500; font-family:'Courier New',monospace;">${reference}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:14px; color:#6b7280;">Status</td>
          <td style="padding:6px 0; font-size:14px; color:#16a34a; font-weight:600;">Completed</td>
        </tr>
      </table>
    `)}
    ${ctaButton("View My Account", `${emailConfig.appUrl}/dashboard`, "#16a34a")}
    ${paragraph("If you have any questions about this transaction, please contact our support team.")}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

Your ${isDeposit ? "deposit" : "withdrawal"} of ${formattedAmount} has been approved.

Reference: ${reference}
Status: Completed

Visit your dashboard: ${emailConfig.appUrl}/dashboard

Best regards,
${emailConfig.appName} Team
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `${isDeposit ? "Deposit approved" : "Withdrawal processed"} — ${formattedAmount} | ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({
        preheader: `Your ${isDeposit ? "deposit" : "withdrawal"} of ${formattedAmount} has been approved.`,
        body,
      }),
    });
    console.log(`✅ Fund operation approved email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send fund operation approved email to ${email}:`, err);
  }
}

/**
 * Send fund operation rejected email (deposit or withdrawal)
 */
export async function sendFundOperationRejectedEmail(
  email: string,
  firstName: string,
  type: "deposit" | "withdrawal",
  amount: number,
  reason?: string
) {
  const isDeposit = type === "deposit";
  const formattedAmount = `$${amount.toLocaleString()}`;
  const defaultReason = isDeposit
    ? "Your deposit request did not meet our requirements. Please contact support for more details."
    : "Your withdrawal request could not be processed. Please contact support for more details.";

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">&#10007;</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">${isDeposit ? "Deposit Request Rejected" : "Withdrawal Request Rejected"}</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">Your request requires attention</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph(`We have reviewed your ${isDeposit ? "deposit" : "withdrawal"} request of <strong>${formattedAmount}</strong> and unfortunately it has been <strong>rejected</strong>.`)}
    ${dangerBox(`
      <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#b91c1c;">Reason:</p>
      <p style="margin:0; font-size:14px; color:#7f1d1d;">${reason || defaultReason}</p>
    `)}
    ${paragraph("If you believe this was an error or need further clarification, please reach out to our support team.")}
    ${ctaButton("Contact Support", `mailto:support@alvarado.com`, "#dc2626")}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

Your ${isDeposit ? "deposit" : "withdrawal"} request of ${formattedAmount} has been rejected.

Reason: ${reason || defaultReason}

If you have questions, contact us at support@alvarado.com

Best regards,
${emailConfig.appName} Team
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `${isDeposit ? "Deposit" : "Withdrawal"} request rejected — ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({
        preheader: `Your ${isDeposit ? "deposit" : "withdrawal"} request of ${formattedAmount} was not approved.`,
        body,
      }),
    });
    console.log(`✅ Fund operation rejected email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send fund operation rejected email to ${email}:`, err);
  }
}

// ─── Bid Emails ────────────────────────────────────────────────────────────────

export async function sendBidSubmittedEmailToAdmin(
  adminEmail: string,
  user: { name: string; email: string },
  property: { title: string; location: string },
  amount: number
) {
  const formattedAmount = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const body = `
    ${paragraph(`A new bid has been submitted and requires your review.`)}
    ${infoBox(`
      <p style="margin:0 0 6px; font-size:14px;"><strong>Property:</strong> ${property.title}</p>
      <p style="margin:0 0 6px; font-size:14px;"><strong>Location:</strong> ${property.location}</p>
      <p style="margin:0 0 6px; font-size:14px;"><strong>Bidder:</strong> ${user.name}</p>
      <p style="margin:0 0 6px; font-size:14px;"><strong>Bidder Email:</strong> ${user.email}</p>
      <p style="margin:0; font-size:14px;"><strong>Bid Amount:</strong> ${formattedAmount}</p>
    `)}
    ${paragraph("Please review this bid and follow up with the bidder via email to proceed with the purchase process.")}
  `;

  const textContent = `
New Bid Submitted

Property: ${property.title}
Location: ${property.location}
Bidder: ${user.name} (${user.email})
Bid Amount: ${formattedAmount}

Please review and follow up with the bidder.
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      replyTo: user.email,
      subject: `[New Bid] ${formattedAmount} on ${property.title} — ${user.name}`,
      text: textContent,
      html: emailWrapper({ preheader: `New bid of ${formattedAmount} on ${property.title}`, body }),
    });
    console.log(`✅ Bid admin notification sent for ${property.title}`);
  } catch (err) {
    console.error(`❌ Failed to send bid admin email:`, err);
  }
}

export async function sendBidConfirmationEmailToUser(
  email: string,
  firstName: string,
  propertyTitle: string,
  amount: number
) {
  const formattedAmount = `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">🏘️</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">Bid Received!</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">Your bid is under review</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph(`We have successfully received your bid of <strong>${formattedAmount}</strong> on <strong>${propertyTitle}</strong>.`)}
    ${bigAmount(formattedAmount)}
    ${successBox(`
      <p style="margin:0 0 6px; font-size:14px; font-weight:600; color:#166534;">What happens next?</p>
      <p style="margin:0; font-size:14px; color:#14532d;">Our team will review your bid and reach out to you via email with next steps to complete your purchase. Please keep an eye on your inbox (and spam folder).</p>
    `)}
    ${paragraph("If you have any questions in the meantime, feel free to contact our support team.")}
    ${ctaButton("View Property", `${emailConfig.appUrl}/dashboard/property-market/properties`, BRAND_PRIMARY)}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

Your bid of ${formattedAmount} on ${propertyTitle} has been received.

Our team will review your bid and contact you via email with next steps for purchase. Please keep an eye on your inbox.

Best regards,
${emailConfig.appName} Team
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Bid received — ${propertyTitle} | ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({ preheader: `Your bid of ${formattedAmount} on ${propertyTitle} was received.`, body }),
    });
    console.log(`✅ Bid confirmation email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send bid confirmation email to ${email}:`, err);
  }
}

// ─── Buy Now Emails ────────────────────────────────────────────────────────────

export async function sendBuyNowEmailToAdmin(
  adminEmail: string,
  user: { name: string; email: string },
  property: { title: string; location: string; price: number }
) {
  const formattedPrice = `$${property.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const body = `
    ${paragraph(`A direct purchase request has been submitted and requires your attention.`)}
    ${infoBox(`
      <p style="margin:0 0 6px; font-size:14px;"><strong>Property:</strong> ${property.title}</p>
      <p style="margin:0 0 6px; font-size:14px;"><strong>Location:</strong> ${property.location}</p>
      <p style="margin:0 0 6px; font-size:14px;"><strong>Listed Price:</strong> ${formattedPrice}</p>
      <p style="margin:0 0 6px; font-size:14px;"><strong>Buyer:</strong> ${user.name}</p>
      <p style="margin:0; font-size:14px;"><strong>Buyer Email:</strong> ${user.email}</p>
    `)}
    ${paragraph("Please assign a property manager to follow up with the buyer as soon as possible.")}
  `;

  const textContent = `
Direct Purchase Request

Property: ${property.title}
Location: ${property.location}
Listed Price: ${formattedPrice}
Buyer: ${user.name} (${user.email})

Please assign a property manager to follow up with the buyer.
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      replyTo: user.email,
      subject: `[Buy Now] ${property.title} — ${user.name}`,
      text: textContent,
      html: emailWrapper({ preheader: `Direct purchase request for ${property.title} from ${user.name}`, body }),
    });
    console.log(`✅ Buy now admin notification sent for ${property.title}`);
  } catch (err) {
    console.error(`❌ Failed to send buy now admin email:`, err);
  }
}

export async function sendBuyNowConfirmationEmailToUser(
  email: string,
  firstName: string,
  property: { title: string; location: string; price: number }
) {
  const formattedPrice = `$${property.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">🏠</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">Purchase Request Received!</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">A property manager will reach out to you shortly</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph(`We have received your purchase request for <strong>${property.title}</strong> listed at <strong>${formattedPrice}</strong>.`)}
    ${bigAmount(formattedPrice)}
    ${successBox(`
      <p style="margin:0 0 6px; font-size:14px; font-weight:600; color:#166534;">What happens next?</p>
      <p style="margin:0; font-size:14px; color:#14532d;">A dedicated property manager will contact you via email shortly to guide you through the purchase process, documentation, and next steps.</p>
    `)}
    ${paragraph("Please keep an eye on your inbox — including your spam/junk folder. If you have any questions, feel free to reach out to our support team.")}
    ${ctaButton("View Property", `${emailConfig.appUrl}/dashboard/property-market/properties`, BRAND_PRIMARY)}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

Your purchase request for ${property.title} (${formattedPrice}) has been received.

A property manager will contact you via email shortly with next steps. Please keep an eye on your inbox.

Best regards,
${emailConfig.appName} Team
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Purchase request received — ${property.title} | ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({ preheader: `Your purchase request for ${property.title} was received. A property manager will reach out soon.`, body }),
    });
    console.log(`✅ Buy now confirmation email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send buy now confirmation email to ${email}:`, err);
  }
}


/**
 * Send referral commission email to referrer when referred user makes first deposit
 */
export async function sendReferralCommissionEmail(
  email: string,
  firstName: string,
  referredName: string,
  commission: number,
  depositAmount: number
) {
  const formattedCommission = `$${commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formattedDeposit = `$${depositAmount.toLocaleString()}`;

  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px; background:linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-radius:10px;">
          <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;line-height:60px;text-align:center;font-size:28px;margin-bottom:12px;">&#127775;</div>
          <h2 style="margin:0; font-size:22px; font-weight:700; color:#ffffff;">Referral Commission Earned!</h2>
          <p style="margin:8px 0 0; font-size:14px; color:rgba(255,255,255,0.9);">Your referral just made their first deposit</p>
        </td>
      </tr>
    </table>
    ${paragraph(`Hello <strong>${firstName}</strong>,`)}
    ${paragraph(`Great news! <strong>${referredName}</strong>, who joined Alvarado through your referral link, has just made their first deposit of <strong>${formattedDeposit}</strong>. As a thank-you, you've earned a 5% referral commission:`)}
    ${bigAmount(formattedCommission, '#6d28d9')}
    ${successBox(`<p style="margin:0; font-size:14px; color:#065f46;"><strong>&#10003; Commission credited:</strong> ${formattedCommission} has been added to your account balance.</p>`)}
    ${paragraph('Keep sharing your referral link to earn more commissions every time a new member makes their first deposit!')}
    ${ctaButton(`${emailConfig.appUrl}/dashboard/my-referral`, 'View My Referrals')}
    <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
  `;

  const textContent = `
Hello ${firstName},

You earned a referral commission!

${referredName} made their first deposit of ${formattedDeposit}.
Your 5% commission: ${formattedCommission} has been credited to your account balance.

Log in to view your referral earnings: ${emailConfig.appUrl}/dashboard/my-referral

---
${emailConfig.appName}
This is an automated message. Do not reply.
  `.trim();

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `You earned ${formattedCommission} referral commission! | ${emailConfig.appName}`,
      text: textContent,
      html: emailWrapper({ preheader: `${referredName} made their first deposit — you earned ${formattedCommission} referral commission!`, body }),
    });
    console.log(`✅ Referral commission email sent to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send referral commission email to ${email}:`, err);
  }
}
