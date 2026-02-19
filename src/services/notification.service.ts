import { prisma } from "../config/database.js";
import { transporter, emailConfig } from "../config/email.js";
import { env } from "../config/env.js";
import { emitToUser } from "./socket.service.js";
import {
  emailWrapper,
  ctaButton,
  infoBox,
  warningBox,
  successBox,
  dangerBox,
  detailRow,
  detailTable,
  sectionHeading,
  paragraph,
  bigAmount,
  badge,
  BRAND_PRIMARY,
} from "../utils/emailTemplate.js";

export enum NotificationType {
  EMAIL = "email",
  PUSH = "push",
  LOGIN_ALERT = "login_alert",
  MARKETING = "marketing",
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Check if user has enabled a specific notification type
 */
async function canSendNotification(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: {
        emailNotifications: true,
        pushNotifications: true,
        loginAlerts: true,
        marketingEmails: true,
      },
    });

    if (!settings) {
      return type !== NotificationType.MARKETING;
    }

    switch (type) {
      case NotificationType.EMAIL:
        return settings.emailNotifications;
      case NotificationType.PUSH:
        return settings.pushNotifications;
      case NotificationType.LOGIN_ALERT:
        return settings.loginAlerts;
      case NotificationType.MARKETING:
        return settings.marketingEmails;
      default:
        return false;
    }
  } catch (error) {
    console.error("Error checking notification settings:", error);
    return false;
  }
}

/**
 * Send email notification (checks user settings first)
 */
export async function sendEmailNotification(
  userId: string,
  emailOptions: EmailOptions,
  type: NotificationType = NotificationType.EMAIL
): Promise<boolean> {
  try {
    const canSend = await canSendNotification(userId, type);
    if (!canSend) {
      console.log(`📭 Notification blocked by user settings: ${type} for user ${userId}`);
      return false;
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Email not configured, skipping email send");
      return false;
    }

    const sendPromise = transporter.sendMail({
      from: emailConfig.from,
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: emailOptions.html,
      text: emailOptions.text || emailOptions.html.replace(/<[^>]*>/g, ""),
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email send timeout")), 10000)
    );

    await Promise.race([sendPromise, timeoutPromise]);

    console.log(`✅ Email sent: ${emailOptions.subject} to ${emailOptions.to}`);
    return true;
  } catch (error: any) {
    console.error("⚠️  Email send failed:", error?.message || error);
    return false;
  }
}

/**
 * Create in-app notification
 */
export async function createInAppNotification(
  userId: string,
  type: string,
  title: string,
  message: string
): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false,
      },
    });
    emitToUser(userId, "notification", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: notification.createdAt,
      read: false,
    });
    console.log(`✅ In-app notification created for user ${userId}`);
  } catch (error) {
    console.error("Error creating in-app notification:", error);
  }
}

/**
 * Send login alert notification
 */
export async function sendLoginAlert(
  userId: string,
  userEmail: string,
  device: string,
  browser: string,
  location: string,
  ipAddress: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const userName = user ? `${user.firstName} ${user.lastName}` : "User";

    const body = `
      ${sectionHeading("New Login Detected")}
      ${paragraph(`Hello <strong>${userName}</strong>,`)}
      ${paragraph(`A new sign-in was detected on your <strong>${emailConfig.appName}</strong> account. If this was you, no further action is needed.`)}
      ${detailTable(
        detailRow("Device", device) +
        detailRow("Browser", browser) +
        detailRow("Location", location) +
        detailRow("IP Address", ipAddress) +
        detailRow("Time", new Date().toLocaleString())
      )}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
        <tr>
          <td style="background:#fffbeb; border-radius:6px; padding:16px 20px;">
            <p style="margin:0; font-size:14px; color:#92400e;"><strong>Wasn't you?</strong> Secure your account immediately — change your password and review your active sessions.</p>
          </td>
        </tr>
      </table>
      ${ctaButton("Review Active Sessions", `${emailConfig.appUrl}/dashboard/settings?tab=sessions`)}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Security Team</strong></p>
    `;

    const html = emailWrapper({
      preheader: `New login from ${device} in ${location}.`,
      body,
    });

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `New login to your ${emailConfig.appName} account`,
        html,
        text: `Hello ${userName},\n\nA new login was detected on your ${emailConfig.appName} account.\n\nDevice: ${device}\nBrowser: ${browser}\nLocation: ${location}\nIP: ${ipAddress}\nTime: ${new Date().toLocaleString()}\n\nIf this wasn't you, secure your account immediately.\n\n${emailConfig.appUrl}/dashboard/settings?tab=sessions`,
      },
      NotificationType.LOGIN_ALERT
    );

    await createInAppNotification(
      userId,
      "security",
      "New Login Detected",
      `New login from ${device} (${browser}) in ${location}`
    );

    emitToUser(userId, "login_alert", {
      device,
      browser,
      location,
      ipAddress,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error sending login alert:", error);
  }
}

/**
 * Send account deactivation farewell email
 */
export async function sendAccountDeactivationEmail(
  _userId: string,
  userEmail: string,
  firstName: string
): Promise<void> {
  try {
    const supportEmail = `support@${new URL(emailConfig.appUrl).hostname}`;

    const body = `
      ${sectionHeading("Goodbye for Now, " + firstName)}
      ${paragraph(`Dear <strong>${firstName}</strong>,`)}
      ${paragraph("Your account has been deactivated as requested. We're sorry to see you go — it's been a privilege having you as part of our community.")}
      ${infoBox(`
        <p style="margin:0 0 6px; font-size:15px; font-style:italic; color:#374151; line-height:1.8;">"Every journey has its seasons, and we understand that sometimes paths change. It meant the world to us to have you as part of our community — whether you were just starting out or had been with us through every milestone."</p>
      `)}
      ${successBox(`
        <p style="margin:0 0 10px; font-size:14px; font-weight:600; color:#15803d;">Your data is safely retained.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="padding:4px 0; font-size:14px; color:#166534;">&#10003;&nbsp; Your account and data are securely preserved</td></tr>
          <tr><td style="padding:4px 0; font-size:14px; color:#166534;">&#10003;&nbsp; No information has been permanently deleted</td></tr>
          <tr><td style="padding:4px 0; font-size:14px; color:#166534;">&#10003;&nbsp; Your investment history and records remain intact</td></tr>
        </table>
      `)}
      ${paragraph("Whenever you're ready to return — whether tomorrow or next year — we'll restore your account exactly as you left it. Just reach out and we'll take care of the rest.")}
      ${ctaButton("Contact Support to Return", `mailto:${supportEmail}`)}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">With gratitude,<br><strong style="color:#374151;">The ${emailConfig.appName} Team</strong></p>
    `;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Email not configured, skipping account deactivation email");
      return;
    }

    await transporter.sendMail({
      from: emailConfig.from,
      to: userEmail,
      subject: `We'll miss you, ${firstName} — Your account has been deactivated`,
      html: emailWrapper({ preheader: "Your account has been deactivated. Your data is safely retained.", body }),
      text: `Dear ${firstName},\n\nYour ${emailConfig.appName} account has been deactivated as requested.\n\nYour data is safely retained. Contact ${supportEmail} to restore your account at any time.\n\nWith gratitude,\n${emailConfig.appName} Team`,
    });

    console.log(`💙 Account deactivation email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending account deactivation email:", error);
  }
}

/**
 * Send email to admin when a new support ticket is created
 */
export async function notifyAdminNewTicket(
  userEmail: string,
  userName: string,
  ticketId: string,
  subject: string,
  category: string,
  priority: string,
  message: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const priorityColors: Record<string, string> = {
      low: "#6b7280",
      medium: "#3b82f6",
      high: "#f97316",
      urgent: "#ef4444",
    };

    const body = `
      ${badge("New Support Ticket", priorityColors[priority] || "#6b7280")}
      <br><br>
      ${sectionHeading("New Support Ticket")}
      ${paragraph("A user has submitted a new support request requiring your attention.")}
      ${detailTable(
        detailRow("From", `${userName} (${userEmail})`) +
        detailRow("Ticket ID", ticketId) +
        detailRow("Subject", subject) +
        detailRow("Category", category) +
        detailRow("Priority", `<span style="color:${priorityColors[priority] || "#6b7280"}; font-weight:700; text-transform:uppercase;">${priority}</span>`) +
        detailRow("Submitted", new Date().toLocaleString())
      )}
      ${infoBox(`<p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#374151;">Message:</p><p style="margin:0; font-size:14px; color:#374151; white-space:pre-wrap;">${message}</p>`)}
      ${ctaButton("View Ticket", `${emailConfig.appUrl}/dashboard/support`)}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[${priority.toUpperCase()}] New Support Ticket: ${subject}`,
      html: emailWrapper({ preheader: `New ${priority} priority ticket from ${userName}.`, body }),
      text: `New support ticket from ${userName} (${userEmail})\n\nSubject: ${subject}\nCategory: ${category}\nPriority: ${priority}\nTicket ID: ${ticketId}\n\nMessage:\n${message}`,
    });

    console.log(`✅ Admin ticket notification sent to ${adminEmail}`);
  } catch (error) {
    console.error("Error sending admin ticket notification:", error);
  }
}

/**
 * Send email to admin when a user replies to a ticket
 */
export async function notifyAdminTicketReply(
  userEmail: string,
  userName: string,
  ticketId: string,
  subject: string,
  message: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const body = `
      ${badge("Ticket Reply", "#3b82f6")}
      <br><br>
      ${sectionHeading("Ticket Reply Received")}
      ${paragraph("A user has replied to their support ticket.")}
      ${detailTable(
        detailRow("From", `${userName} (${userEmail})`) +
        detailRow("Ticket ID", ticketId) +
        detailRow("Subject", subject) +
        detailRow("Time", new Date().toLocaleString())
      )}
      ${infoBox(`<p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#374151;">Reply:</p><p style="margin:0; font-size:14px; color:#374151; white-space:pre-wrap;">${message}</p>`)}
      ${ctaButton("View Ticket", `${emailConfig.appUrl}/dashboard/support`, "#3b82f6")}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Reply] Ticket: ${subject}`,
      html: emailWrapper({ preheader: `${userName} replied to ticket: ${subject}.`, body }),
      text: `Reply from ${userName} (${userEmail})\n\nTicket ID: ${ticketId}\nSubject: ${subject}\n\nReply:\n${message}`,
    });

    console.log(`✅ Admin reply notification sent to ${adminEmail}`);
  } catch (error) {
    console.error("Error sending admin reply notification:", error);
  }
}

/**
 * Send email to admin when a manual deposit request is submitted
 */
export async function notifyAdminManualDeposit(
  userName: string,
  userEmail: string,
  amount: number,
  method: string,
  reference: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const methodLabel = method === "crypto"
      ? `Cryptocurrency (${details.cryptoType || "Unknown"})`
      : "Bank Transfer";
    const userContactEmail = (details.email as string) || userEmail;

    const body = `
      ${badge("Manual Deposit Request", "#f97316")}
      <br><br>
      ${sectionHeading("Manual Deposit Request")}
      ${paragraph("A user has submitted a manual deposit request and is awaiting payment instructions.")}
      ${bigAmount(`$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#f97316")}
      ${detailTable(
        detailRow("Reference", reference) +
        detailRow("Method", methodLabel) +
        detailRow("User", userName) +
        detailRow("Account Email", userEmail) +
        detailRow("Send Instructions To", `<strong>${userContactEmail}</strong>`) +
        detailRow("Submitted", new Date().toLocaleString())
      )}
      ${warningBox(`
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#92400e;">Action Required:</p>
        <ul style="margin:0; padding-left:18px; font-size:14px; color:#92400e;">
          <li style="margin-bottom:4px;">Reply to <strong>${userContactEmail}</strong> with your ${method === "crypto" ? "wallet address" : "bank account"} details</li>
          <li style="margin-bottom:4px;">Include reference <strong>${reference}</strong> in your response</li>
          <li>Update the deposit status once confirmed</li>
        </ul>
      `)}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Manual Deposit] $${amount.toFixed(2)} via ${methodLabel} — ${reference}`,
      html: emailWrapper({ preheader: `Manual deposit $${amount.toFixed(2)} from ${userName} awaiting instructions.`, body }),
      text: `Manual deposit request\n\nReference: ${reference}\nAmount: $${amount.toFixed(2)}\nMethod: ${methodLabel}\nUser: ${userName} (${userEmail})\nSend instructions to: ${userContactEmail}\nSubmitted: ${new Date().toLocaleString()}`,
    });

    console.log(`✅ Admin manual deposit notification sent to ${adminEmail} — ${reference}`);
  } catch (error) {
    console.error("Error sending admin manual deposit notification:", error);
  }
}

/**
 * Send email to admin when a withdrawal request is submitted
 */
export async function notifyAdminWithdrawal(
  userName: string,
  userEmail: string,
  amount: number,
  method: string,
  reference: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const methodLabel = method === "crypto"
      ? `Cryptocurrency (${details.cryptoType || "Unknown"}) — ${details.network || ""}`
      : "Bank Transfer";

    const destinationRows = method === "crypto"
      ? detailRow("Wallet Address", `<code style="font-family:'Courier New',monospace; font-size:12px; background:#f1f5f9; padding:2px 6px; border-radius:4px; word-break:break-all;">${details.walletAddress || "N/A"}</code>`) +
        detailRow("Network", String(details.network || "N/A"))
      : detailRow("Bank Name", String(details.bankName || "N/A")) +
        detailRow("Account Name", String(details.accountName || "N/A")) +
        detailRow("Account Number", String(details.accountNumber || "N/A")) +
        (details.routingNumber ? detailRow("Routing", String(details.routingNumber)) : "") +
        (details.swiftCode ? detailRow("SWIFT", String(details.swiftCode)) : "");

    const body = `
      ${badge("Withdrawal Request", "#ef4444")}
      <br><br>
      ${sectionHeading("Withdrawal Request")}
      ${paragraph("A user has submitted a withdrawal request. Please process and send funds.")}
      ${bigAmount(`$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#ef4444")}
      ${detailTable(
        detailRow("Reference", reference) +
        detailRow("Method", methodLabel) +
        detailRow("User", `${userName} (${userEmail})`) +
        destinationRows +
        detailRow("Submitted", new Date().toLocaleString())
      )}
      ${dangerBox(`
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#b91c1c;">Action Required:</p>
        <ul style="margin:0; padding-left:18px; font-size:14px; color:#7f1d1d;">
          <li style="margin-bottom:4px;">Verify user balance before processing</li>
          <li style="margin-bottom:4px;">Send funds to the ${method === "crypto" ? "wallet address" : "bank account"} above</li>
          <li style="margin-bottom:4px;">Include reference <strong>${reference}</strong> in transfer notes</li>
          <li>Update withdrawal status once sent</li>
        </ul>
      `)}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Withdrawal] $${amount.toFixed(2)} via ${method === "crypto" ? (details.cryptoType as string) || "Crypto" : "Bank"} — ${reference}`,
      html: emailWrapper({ preheader: `Withdrawal request $${amount.toFixed(2)} from ${userName} needs processing.`, body }),
      text: `Withdrawal request\n\nReference: ${reference}\nAmount: $${amount.toFixed(2)}\nMethod: ${methodLabel}\nUser: ${userName} (${userEmail})\nSubmitted: ${new Date().toLocaleString()}\n\nAction: process and send funds.`,
    });

    console.log(`✅ Admin withdrawal notification sent to ${adminEmail} — ${reference}`);
  } catch (error) {
    console.error("Error sending admin withdrawal notification:", error);
  }
}

/**
 * Send payment receipt to admin when user uploads proof of payment
 */
export async function notifyAdminPaymentReceipt(
  userName: string,
  userEmail: string,
  reference: string,
  amount: number,
  method: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const methodLabel = method === "crypto" ? "Cryptocurrency" : method === "bank" ? "Bank Transfer" : "Card";

    const body = `
      ${badge("Payment Receipt", "#10b981")}
      <br><br>
      ${sectionHeading("Payment Receipt Received")}
      ${paragraph("A user has uploaded a payment receipt for a pending deposit. Please review and process accordingly.")}
      ${bigAmount(`$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#10b981")}
      ${detailTable(
        detailRow("Reference", reference) +
        detailRow("Method", methodLabel) +
        detailRow("User", userName) +
        detailRow("Email", userEmail) +
        detailRow("File", fileName) +
        detailRow("Submitted", new Date().toLocaleString())
      )}
      ${successBox(`
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#15803d;">Action Required:</p>
        <ul style="margin:0; padding-left:18px; font-size:14px; color:#166534;">
          <li style="margin-bottom:4px;">Review the attached payment receipt</li>
          <li style="margin-bottom:4px;">Verify transfer matches reference <strong>${reference}</strong></li>
          <li style="margin-bottom:4px;">Credit the user's account once confirmed</li>
          <li>Update deposit status to completed</li>
        </ul>
      `)}
      <p style="margin:8px 0 20px; font-size:13px; color:#6b7280;">The receipt file is attached to this email.</p>
      <p style="margin:0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Payment Receipt] $${amount.toFixed(2)} — ${reference}`,
      html: emailWrapper({ preheader: `Payment receipt uploaded for $${amount.toFixed(2)} — ${reference}.`, body }),
      text: `Payment receipt uploaded\n\nReference: ${reference}\nAmount: $${amount.toFixed(2)}\nMethod: ${methodLabel}\nUser: ${userName} (${userEmail})\nFile: ${fileName}\nSubmitted: ${new Date().toLocaleString()}\n\nAction: review receipt and credit account.`,
      attachments: [{ filename: fileName, content: fileBuffer, contentType: mimeType }],
    });

    console.log(`✅ Admin payment receipt notification sent to ${adminEmail} — ${reference}`);
  } catch (error) {
    console.error("Error sending admin receipt notification:", error);
  }
}

/**
 * Send transaction notification to user
 */
export async function sendTransactionNotification(
  userId: string,
  userEmail: string,
  transactionType: string,
  amount: number,
  description: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, balance: true },
    });

    const typeLabel = transactionType.replace(/_/g, " ").toUpperCase();

    const body = `
      ${sectionHeading("Transaction Notification")}
      ${paragraph(`Hello <strong>${user?.firstName || "there"}</strong>,`)}
      ${paragraph("A transaction has been processed on your account.")}
      ${bigAmount(`$${amount.toFixed(2)}`)}
      ${detailTable(
        detailRow("Type", typeLabel) +
        detailRow("Description", description) +
        detailRow("Time", new Date().toLocaleString()) +
        detailRow("New Balance", `<strong>$${(user?.balance || 0).toFixed(2)}</strong>`)
      )}
      ${ctaButton("View Transaction History", `${emailConfig.appUrl}/dashboard/transactions`)}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `Transaction processed: ${typeLabel} — $${amount.toFixed(2)}`,
        html: emailWrapper({ preheader: `${typeLabel} of $${amount.toFixed(2)} processed on your account.`, body }),
      },
      NotificationType.EMAIL
    );

    await createInAppNotification(
      userId,
      "transaction",
      typeLabel,
      `$${amount.toFixed(2)} - ${description}`
    );
  } catch (error) {
    console.error("Error sending transaction notification:", error);
  }
}

/**
 * Send notification when user sends a transfer
 */
export async function sendTransferSentNotification(
  userId: string,
  userEmail: string,
  recipientEmail: string,
  amount: number,
  newBalance: number,
  transferId: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    const body = `
      ${sectionHeading("Transfer Sent")}
      ${paragraph(`Hello <strong>${user?.firstName || "there"}</strong>,`)}
      ${paragraph(`You have successfully sent money to <strong>${recipientEmail}</strong>.`)}
      ${bigAmount(`-$${amount.toFixed(2)}`, "#ef4444")}
      ${detailTable(
        detailRow("Recipient", recipientEmail) +
        detailRow("Transfer ID", transferId) +
        detailRow("Time", new Date().toLocaleString()) +
        detailRow("New Balance", `<strong>$${newBalance.toFixed(2)}</strong>`)
      )}
      ${ctaButton("View Transfer History", `${emailConfig.appUrl}/dashboard/transfers`)}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `Transfer sent: $${amount.toFixed(2)} to ${recipientEmail}`,
        html: emailWrapper({ preheader: `You sent $${amount.toFixed(2)} to ${recipientEmail}.`, body }),
        text: `Hello ${user?.firstName || "there"},\n\nYou sent $${amount.toFixed(2)} to ${recipientEmail}.\n\nTransfer ID: ${transferId}\nNew Balance: $${newBalance.toFixed(2)}\n\nView history: ${emailConfig.appUrl}/dashboard/transfers`,
      },
      NotificationType.EMAIL
    );

    await createInAppNotification(userId, "transfer", "Transfer Sent", `$${amount.toFixed(2)} sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending transfer sent notification:", error);
  }
}

/**
 * Send notification when user receives a transfer
 */
export async function sendTransferReceivedNotification(
  userId: string,
  userEmail: string,
  senderEmail: string,
  amount: number,
  newBalance: number,
  transferId: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    const body = `
      ${sectionHeading("Money Received")}
      ${paragraph(`Hello <strong>${user?.firstName || "there"}</strong>,`)}
      ${paragraph(`You have received a transfer from <strong>${senderEmail}</strong>.`)}
      ${bigAmount(`+$${amount.toFixed(2)}`, "#22c55e")}
      ${detailTable(
        detailRow("From", senderEmail) +
        detailRow("Transfer ID", transferId) +
        detailRow("Time", new Date().toLocaleString()) +
        detailRow("New Balance", `<strong>$${newBalance.toFixed(2)}</strong>`)
      )}
      ${ctaButton("View Transfer Details", `${emailConfig.appUrl}/dashboard/transfers`, "#22c55e")}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `You received $${amount.toFixed(2)} from ${senderEmail}`,
        html: emailWrapper({ preheader: `$${amount.toFixed(2)} has been transferred to your account.`, body }),
        text: `Hello ${user?.firstName || "there"},\n\nYou received $${amount.toFixed(2)} from ${senderEmail}.\n\nTransfer ID: ${transferId}\nNew Balance: $${newBalance.toFixed(2)}\n\nView details: ${emailConfig.appUrl}/dashboard/transfers`,
      },
      NotificationType.EMAIL
    );

    await createInAppNotification(userId, "transfer", "Money Received", `$${amount.toFixed(2)} received from ${senderEmail}`);

    emitToUser(userId, "transfer_received", {
      amount,
      senderEmail,
      newBalance,
      transferId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error sending transfer received notification:", error);
  }
}

/**
 * Send notification when transfer fails
 */
export async function sendTransferFailedNotification(
  userId: string,
  recipientEmail: string,
  amount: number,
  reason: string
): Promise<void> {
  try {
    await createInAppNotification(
      userId,
      "transfer",
      "Transfer Failed",
      `Transfer of $${amount.toFixed(2)} to ${recipientEmail} failed: ${reason}`
    );

    emitToUser(userId, "transfer_failed", {
      amount,
      recipientEmail,
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error sending transfer failed notification:", error);
  }
}

/**
 * Send notification when someone uses your referral code
 */
export async function sendReferralSuccessNotification(
  referrerId: string,
  referrerEmail: string,
  newUserName: string,
  bonus: number
): Promise<void> {
  try {
    const referrer = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { firstName: true },
    });

    const body = `
      ${sectionHeading("Referral Bonus Earned!")}
      ${paragraph(`Hello <strong>${referrer?.firstName || "there"}</strong>,`)}
      ${paragraph(`Great news! <strong>${newUserName}</strong> just joined ${emailConfig.appName} using your referral code, and you've earned a bonus!`)}
      ${bigAmount(`+$${bonus.toFixed(2)}`, "#8b5cf6")}
      ${infoBox(`<p style="margin:0; font-size:14px; color:#374151; text-align:center;">Keep sharing your referral code to earn more bonuses every time someone joins!</p>`)}
      ${ctaButton("View Referral Dashboard", `${emailConfig.appUrl}/dashboard/referral`, "#8b5cf6")}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
    `;

    await sendEmailNotification(
      referrerId,
      {
        to: referrerEmail,
        subject: `You earned $${bonus.toFixed(2)} — Referral bonus from ${newUserName}`,
        html: emailWrapper({ preheader: `${newUserName} joined using your referral. You earned $${bonus.toFixed(2)}!`, body }),
        text: `Hello ${referrer?.firstName || "there"},\n\n${newUserName} joined using your referral code and you earned $${bonus.toFixed(2)}!\n\nView your referral dashboard: ${emailConfig.appUrl}/dashboard/referral`,
      },
      NotificationType.EMAIL
    );

    await createInAppNotification(referrerId, "referral", "Referral Bonus Earned!", `${newUserName} joined using your code. You earned $${bonus.toFixed(2)}!`);

    emitToUser(referrerId, "referral_success", { newUserName, bonus, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error sending referral success notification:", error);
  }
}

/**
 * Send welcome bonus notification to new user
 */
export async function sendWelcomeBonusNotification(
  newUserId: string,
  newUserEmail: string,
  newUserName: string,
  referrerName: string,
  bonus: number
): Promise<void> {
  try {
    const body = `
      ${sectionHeading("Welcome Bonus Received!")}
      ${paragraph(`Hello <strong>${newUserName}</strong>,`)}
      ${paragraph(`Welcome to <strong>${emailConfig.appName}</strong>! Since you joined via <strong>${referrerName}'s</strong> referral, we've added a welcome bonus to your account.`)}
      ${bigAmount(`+$${bonus.toFixed(2)}`, "#8b5cf6")}
      ${successBox(`<p style="margin:0; font-size:14px; color:#166534; text-align:center;">Your welcome bonus has been added to your account. Start investing today and grow your wealth!</p>`)}
      ${ctaButton("Go to Dashboard", `${emailConfig.appUrl}/dashboard`, "#8b5cf6")}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
    `;

    await sendEmailNotification(
      newUserId,
      {
        to: newUserEmail,
        subject: `Welcome! You've received a $${bonus.toFixed(2)} bonus — ${emailConfig.appName}`,
        html: emailWrapper({ preheader: `You received a $${bonus.toFixed(2)} welcome bonus for joining via referral.`, body }),
        text: `Hello ${newUserName},\n\nWelcome to ${emailConfig.appName}! You received a $${bonus.toFixed(2)} welcome bonus for joining via ${referrerName}'s referral.\n\nGo to Dashboard: ${emailConfig.appUrl}/dashboard`,
      },
      NotificationType.EMAIL
    );

    await createInAppNotification(newUserId, "referral", "Welcome Bonus Received!", `You received $${bonus.toFixed(2)} for joining via ${referrerName}'s referral. Start investing today!`);

    emitToUser(newUserId, "welcome_bonus", { referrerName, bonus, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error sending welcome bonus notification:", error);
  }
}

/**
 * Send newsletter welcome email
 */
export async function sendNewsletterWelcomeEmail(
  email: string,
  firstName?: string
): Promise<void> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Email not configured, skipping newsletter welcome email");
      return;
    }

    const subscriberName = firstName || "there";

    const body = `
      ${sectionHeading("Welcome to Our Newsletter!")}
      ${paragraph(`Hello <strong>${subscriberName}</strong>,`)}
      ${paragraph(`Thank you for subscribing to the <strong>${emailConfig.appName}</strong> newsletter. We're excited to have you in our community.`)}
      ${successBox(`
        <p style="margin:0 0 12px; font-size:14px; font-weight:600; color:#15803d;">Here's what you'll receive:</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#128240;&nbsp; Latest platform updates and news</td></tr>
          <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#128161;&nbsp; Exclusive investment tips and market insights</td></tr>
          <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#127873;&nbsp; Special offers and promotions</td></tr>
          <tr><td style="padding:5px 0; font-size:14px; color:#166534;">&#128202;&nbsp; Market trends and performance analysis</td></tr>
        </table>
      `)}
      ${ctaButton("Visit Our Website", emailConfig.appUrl)}
      ${paragraph(`You can unsubscribe at any time by clicking the unsubscribe link in any of our emails. We respect your inbox.`)}
      <p style="margin:20px 0 0; font-size:14px; color:#9ca3af;">Regards,<br><strong style="color:#374151;">${emailConfig.appName} Team</strong></p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: email,
      subject: `Welcome to the ${emailConfig.appName} Newsletter`,
      html: emailWrapper({ preheader: "You're now subscribed to the Alvarado newsletter. Here's what to expect.", body }),
      text: `Hello ${subscriberName},\n\nThank you for subscribing to the ${emailConfig.appName} newsletter!\n\nYou'll receive: updates, investment tips, offers, and market analysis.\n\nVisit us: ${emailConfig.appUrl}`,
    });

    console.log(`✅ Newsletter welcome email sent to ${email}`);
  } catch (error) {
    console.error("Error sending newsletter welcome email:", error);
  }
}

/**
 * Send contact form message to admin
 */
export async function sendContactFormToAdmin(
  name: string,
  email: string,
  phone: string,
  message: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const body = `
      ${badge("New Message", BRAND_PRIMARY)}
      <br><br>
      ${sectionHeading("New Contact Form Submission")}
      ${paragraph("Someone has submitted a message through the website contact form.")}
      ${detailTable(
        detailRow("Name", name) +
        detailRow("Email", `<a href="mailto:${email}" style="color:${BRAND_PRIMARY}; text-decoration:none;">${email}</a>`) +
        detailRow("Phone", phone) +
        detailRow("Received", new Date().toLocaleString())
      )}
      ${infoBox(`<p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#374151;">Message:</p><p style="margin:0; font-size:14px; color:#374151; white-space:pre-wrap;">${message}</p>`)}
      ${paragraph(`You can reply directly to <a href="mailto:${email}" style="color:${BRAND_PRIMARY}; text-decoration:none;">${email}</a>.`)}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Contact Form</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      replyTo: email,
      subject: `New Contact Form: ${name} — ${emailConfig.appName}`,
      html: emailWrapper({ preheader: `New contact form message from ${name}.`, body }),
      text: `New contact form submission\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nReceived: ${new Date().toLocaleString()}\n\nMessage:\n${message}\n\nReply to: ${email}`,
    });

    console.log(`✅ Contact form sent to admin from ${email}`);
  } catch (error) {
    console.error("Error sending contact form to admin:", error);
  }
}

/**
 * Send email to admin when a new user signs up
 */
export async function notifyAdminNewUserSignup(
  userName: string,
  userEmail: string,
  userId: string,
  referralCode?: string,
  referrerName?: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const body = `
      ${badge("New User", "#10b981")}
      <br><br>
      ${sectionHeading("New User Registration")}
      ${paragraph("A new user has joined the platform.")}
      ${detailTable(
        detailRow("Name", userName) +
        detailRow("Email", userEmail) +
        detailRow("User ID", userId) +
        (referralCode ? detailRow("Referral Code Used", referralCode) : "") +
        (referrerName ? detailRow("Referred By", referrerName) : "") +
        detailRow("Registration Time", new Date().toLocaleString())
      )}
      ${paragraph("You can view and manage this user from the admin dashboard.")}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `New User Registration: ${userName} (${userEmail})`,
      html: emailWrapper({ preheader: `New user ${userName} just joined the platform.`, body }),
      text: `New user registration\n\nName: ${userName}\nEmail: ${userEmail}\nUser ID: ${userId}${referralCode ? `\nReferral Code: ${referralCode}` : ""}${referrerName ? `\nReferred By: ${referrerName}` : ""}\nRegistration Time: ${new Date().toLocaleString()}`,
    });

    console.log(`✅ Admin new user signup notification sent to ${adminEmail} for ${userEmail}`);
  } catch (error) {
    console.error("Error sending admin new user signup notification:", error);
  }
}

/**
 * Send email to admin when a user signs in
 */
export async function notifyAdminUserSignin(
  userName: string,
  userEmail: string,
  userId: string,
  device: string,
  browser: string,
  location: string,
  ipAddress: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const body = `
      ${sectionHeading("User Sign-In Activity")}
      ${paragraph("A user has signed into the platform.")}
      ${detailTable(
        detailRow("User", userName) +
        detailRow("Email", userEmail) +
        detailRow("User ID", userId) +
        detailRow("Device", device) +
        detailRow("Browser", browser) +
        detailRow("Location", location) +
        detailRow("IP Address", ipAddress) +
        detailRow("Sign-In Time", new Date().toLocaleString())
      )}
      ${paragraph("This is an automated notification for user sign-in activity monitoring.")}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `User Sign-In: ${userName} (${userEmail}) from ${location}`,
      html: emailWrapper({ preheader: `${userName} signed in from ${location}.`, body }),
      text: `User sign-in\n\nUser: ${userName}\nEmail: ${userEmail}\nUser ID: ${userId}\nDevice: ${device}\nBrowser: ${browser}\nLocation: ${location}\nIP: ${ipAddress}\nTime: ${new Date().toLocaleString()}`,
    });

    console.log(`✅ Admin user signin notification sent to ${adminEmail} for ${userEmail}`);
  } catch (error) {
    console.error("Error sending admin user signin notification:", error);
  }
}

/**
 * Send email to admin when a user submits KYC verification
 */
export async function notifyAdminKYCSubmission(
  userName: string,
  userEmail: string,
  userId: string,
  kycId: string,
  documentType: string,
  nationality: string
): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL;
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;

    const docTypeLabels: Record<string, string> = {
      passport: "Passport",
      drivers_license: "Driver's License",
      national_id: "National ID Card",
    };

    const body = `
      ${badge("Pending Review", "#f59e0b")}
      <br><br>
      ${sectionHeading("New KYC Submission")}
      ${paragraph("A user has submitted their KYC verification documents and is awaiting approval.")}
      ${detailTable(
        detailRow("User", userName) +
        detailRow("Email", userEmail) +
        detailRow("User ID", userId) +
        detailRow("KYC ID", kycId) +
        detailRow("Document Type", docTypeLabels[documentType] || documentType) +
        detailRow("Nationality", nationality) +
        detailRow("Submitted", new Date().toLocaleString())
      )}
      ${warningBox(`
        <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#92400e;">Action Required:</p>
        <ul style="margin:0; padding-left:18px; font-size:14px; color:#92400e;">
          <li style="margin-bottom:4px;">Review uploaded documents (ID, proof of address, selfie)</li>
          <li style="margin-bottom:4px;">Verify information matches the documents</li>
          <li style="margin-bottom:4px;">Approve or reject the KYC submission</li>
          <li>Provide clear feedback if rejecting</li>
        </ul>
      `)}
      ${ctaButton("Review KYC Submission", `${emailConfig.appUrl}/admin/kyc`, "#f59e0b")}
      ${paragraph("Please review this submission within 24–48 hours to maintain service quality.")}
      <p style="margin:20px 0 0; font-size:13px; color:#9ca3af;">${emailConfig.appName} Admin Panel</p>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `New KYC Verification: ${userName} (${userEmail})`,
      html: emailWrapper({ preheader: `${userName} submitted KYC documents for review.`, body }),
      text: `New KYC verification submitted\n\nUser: ${userName}\nEmail: ${userEmail}\nUser ID: ${userId}\nKYC ID: ${kycId}\nDocument Type: ${docTypeLabels[documentType] || documentType}\nNationality: ${nationality}\nSubmitted: ${new Date().toLocaleString()}\n\nReview at: ${emailConfig.appUrl}/admin/kyc`,
    });

    console.log(`✅ Admin KYC submission notification sent to ${adminEmail} for ${userEmail}`);
  } catch (error) {
    console.error("Error sending admin KYC submission notification:", error);
  }
}
