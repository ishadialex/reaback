import { prisma } from "../config/database.js";
import { transporter, emailConfig } from "../config/email.js";
import { env } from "../config/env.js";
import { emitToUser } from "./socket.service.js";

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
      // If no settings exist, use defaults (all enabled except marketing)
      return type !== NotificationType.MARKETING;
    }

    // Check specific setting based on notification type
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
    // Check if user has enabled this notification type
    const canSend = await canSendNotification(userId, type);
    if (!canSend) {
      console.log(`📭 Notification blocked by user settings: ${type} for user ${userId}`);
      return false;
    }

    // Check if email is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Email not configured, skipping email send");
      return false;
    }

    // Send email with timeout
    const sendPromise = transporter.sendMail({
      from: emailConfig.from,
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: emailOptions.html,
      text: emailOptions.text || emailOptions.html.replace(/<[^>]*>/g, ""),
    });

    // Add 10-second timeout
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
    // Push real-time notification to user via Socket.io
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #667eea; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .secure-tip { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Security Alert</h1>
            <p>New login detected on your account</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>We detected a new login to your ${emailConfig.appName} account. If this was you, you can safely ignore this email.</p>

            <div class="alert-box">
              <h3>Login Details:</h3>
              <div class="detail-row">
                <span class="detail-label">Device:</span> ${device}
              </div>
              <div class="detail-row">
                <span class="detail-label">Browser:</span> ${browser}
              </div>
              <div class="detail-row">
                <span class="detail-label">Location:</span> ${location}
              </div>
              <div class="detail-row">
                <span class="detail-label">IP Address:</span> ${ipAddress}
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span> ${new Date().toLocaleString()}
              </div>
            </div>

            <div class="secure-tip">
              <strong>⚠️ If this wasn't you:</strong>
              <ul>
                <li>Change your password immediately</li>
                <li>Enable two-factor authentication</li>
                <li>Review your active sessions</li>
                <li>Contact our support team</li>
              </ul>
            </div>

            <p>
              <a href="${emailConfig.appUrl}/dashboard/settings?tab=sessions"
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
                View Active Sessions
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.</p>
            <p>You received this email because login alerts are enabled for your account.</p>
            <p><a href="${emailConfig.appUrl}/dashboard/settings?tab=notifications">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `🔐 New login to your ${emailConfig.appName} account`,
        html,
      },
      NotificationType.LOGIN_ALERT
    );

    // Also create in-app notification
    await createInAppNotification(
      userId,
      "security",
      "New Login Detected",
      `New login from ${device} (${browser}) in ${location}`
    );
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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { margin: 0 0 10px; font-size: 28px; }
          .header p { margin: 0; opacity: 0.9; font-size: 16px; }
          .content { background: #f9f9f9; padding: 40px 30px; border-radius: 0 0 10px 10px; }
          .farewell-box { background: #fff; border-left: 4px solid #667eea; padding: 25px; margin: 25px 0; border-radius: 5px; font-style: italic; color: #555; font-size: 15px; line-height: 1.9; }
          .info-box { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .info-box ul { margin: 10px 0; padding-left: 20px; }
          .info-box li { margin: 6px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 30px; margin: 15px 0; font-weight: bold; font-size: 15px; }
          .footer { text-align: center; padding: 25px 20px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💙 Goodbye for Now, ${firstName}</h1>
            <p>Your account has been deactivated</p>
          </div>
          <div class="content">
            <p>Dear ${firstName},</p>

            <p>We wanted to take a moment to reach out and let you know that your account has been deactivated, just as you requested.</p>

            <div class="farewell-box">
              "Every journey has its seasons, and we understand that sometimes paths change. It meant the world to us to have you as part of our community — whether you were just starting out or had been with us through every milestone. We hope we played even a small role in your story."
            </div>

            <p>We'll be honest — it's not easy saying goodbye. We've cherished every moment you spent with us, and we hope the experience was valuable to you in some way.</p>

            <div class="info-box">
              <strong>📋 What happens to your data:</strong>
              <ul>
                <li>Your account and all associated data are <strong>safely retained</strong></li>
                <li>No information has been permanently deleted</li>
                <li>Your investment history and records remain intact</li>
              </ul>
            </div>

            <p>If you ever feel the time is right to come back — whether it's tomorrow, next month, or next year — the door is always open. Simply reach out to our support team and we'll restore your account with everything just as you left it.</p>

            <p>
              <a href="mailto:support@${new URL(emailConfig.appUrl).hostname}" class="cta-button">
                Contact Support to Return
              </a>
            </p>

            <p>Thank you for the trust you placed in us. We genuinely wish you all the best in whatever comes next. ❤️</p>

            <p>With gratitude,<br><strong>The ${emailConfig.appName} Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.</p>
            <p>This email was sent because your account was deactivated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Email not configured, skipping account deactivation email");
      return;
    }

    await transporter.sendMail({
      from: emailConfig.from,
      to: userEmail,
      subject: `💙 We'll miss you, ${firstName} — Account Deactivated`,
      html,
      text: `Dear ${firstName},\n\nYour ${emailConfig.appName} account has been deactivated as requested.\n\nYour data is safely retained. If you ever wish to return, contact our support team and we'll restore everything.\n\nThank you for being part of our community.\n\nWith gratitude,\nThe ${emailConfig.appName} Team`,
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
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Admin email not configured, skipping admin ticket notification");
      return;
    }

    const priorityColors: Record<string, string> = {
      low: "#6b7280",
      medium: "#3b82f6",
      high: "#f97316",
      urgent: "#ef4444",
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .ticket-box { background: #fff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">🎫 New Support Ticket</h2>
            <p style="margin:5px 0 0">A user has submitted a new support request</p>
          </div>
          <div class="content">
            <div class="ticket-box">
              <div class="detail-row"><strong>From:</strong> ${userName} (${userEmail})</div>
              <div class="detail-row"><strong>Ticket ID:</strong> ${ticketId}</div>
              <div class="detail-row"><strong>Subject:</strong> ${subject}</div>
              <div class="detail-row"><strong>Category:</strong> ${category}</div>
              <div class="detail-row">
                <strong>Priority:</strong>
                <span class="badge" style="background:${priorityColors[priority] || "#6b7280"}">${priority.toUpperCase()}</span>
              </div>
              <div class="detail-row"><strong>Time:</strong> ${new Date().toLocaleString()}</div>
            </div>
            <p><strong>Message:</strong></p>
            <div style="background:#fff;padding:15px;border-radius:5px;border:1px solid #eee;white-space:pre-wrap">${message}</div>
            <p style="margin-top:20px">
              <a href="${emailConfig.appUrl}/dashboard/support"
                 style="display:inline-block;background:#667eea;color:white;padding:12px 30px;text-decoration:none;border-radius:5px">
                View Ticket
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName} Admin Panel</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[${priority.toUpperCase()}] New Support Ticket: ${subject}`,
      html,
      text: `New support ticket from ${userName} (${userEmail})\n\nSubject: ${subject}\nCategory: ${category}\nPriority: ${priority}\n\nMessage:\n${message}`,
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
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Admin email not configured, skipping admin reply notification");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .reply-box { background: #fff; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">💬 Ticket Reply Received</h2>
            <p style="margin:5px 0 0">A user replied to their support ticket</p>
          </div>
          <div class="content">
            <div class="reply-box">
              <div class="detail-row"><strong>From:</strong> ${userName} (${userEmail})</div>
              <div class="detail-row"><strong>Ticket ID:</strong> ${ticketId}</div>
              <div class="detail-row"><strong>Subject:</strong> ${subject}</div>
              <div class="detail-row"><strong>Time:</strong> ${new Date().toLocaleString()}</div>
            </div>
            <p><strong>Reply:</strong></p>
            <div style="background:#fff;padding:15px;border-radius:5px;border:1px solid #eee;white-space:pre-wrap">${message}</div>
            <p style="margin-top:20px">
              <a href="${emailConfig.appUrl}/dashboard/support"
                 style="display:inline-block;background:#10b981;color:white;padding:12px 30px;text-decoration:none;border-radius:5px">
                View Ticket
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName} Admin Panel</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Reply] Ticket: ${subject}`,
      html,
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
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Admin email not configured, skipping manual deposit notification");
      return;
    }

    const methodLabel = method === "crypto"
      ? `Cryptocurrency (${details.cryptoType || "Unknown"})`
      : "Bank Transfer";

    const userContactEmail = (details.email as string) || userEmail;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 25px 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .deposit-box { background: #fff; border-left: 4px solid #f97316; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .amount { font-size: 28px; font-weight: bold; color: #f97316; margin: 15px 0; }
          .action-box { background: #fff7ed; border: 1px solid #fdba74; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">💰 Manual Deposit Request</h2>
            <p style="margin:5px 0 0">Action required: Send payment instructions to user</p>
          </div>
          <div class="content">
            <p>A user has submitted a manual deposit request and is waiting for payment instructions.</p>

            <div class="deposit-box">
              <div class="amount">$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div class="detail-row"><strong>Reference:</strong> ${reference}</div>
              <div class="detail-row"><strong>Method:</strong> ${methodLabel}</div>
              <div class="detail-row"><strong>User:</strong> ${userName}</div>
              <div class="detail-row"><strong>User Account Email:</strong> ${userEmail}</div>
              <div class="detail-row"><strong>Send Instructions To:</strong> <strong>${userContactEmail}</strong></div>
              <div class="detail-row"><strong>Submitted:</strong> ${new Date().toLocaleString()}</div>
            </div>

            <div class="action-box">
              <strong>⚡ Action Required:</strong>
              <ul style="margin:10px 0;padding-left:20px">
                <li>Reply to <strong>${userContactEmail}</strong> with your ${method === "crypto" ? "wallet address" : "bank account"} details</li>
                <li>Include reference <strong>${reference}</strong> in your response</li>
                <li>Update the deposit status once confirmed</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName} Admin Panel</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Manual Deposit] $${amount.toFixed(2)} via ${methodLabel} — ${reference}`,
      html,
      text: `Manual deposit request\n\nReference: ${reference}\nAmount: $${amount.toFixed(2)}\nMethod: ${methodLabel}\nUser: ${userName} (${userEmail})\nSend instructions to: ${userContactEmail}\nSubmitted: ${new Date().toLocaleString()}\n\nAction required: send payment instructions to ${userContactEmail}`,
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
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Admin email not configured, skipping withdrawal notification");
      return;
    }

    const methodLabel = method === "crypto"
      ? `Cryptocurrency (${details.cryptoType || "Unknown"}) — ${details.network || ""}`
      : "Bank Transfer";

    const destinationHtml = method === "crypto"
      ? `<div class="detail-row"><strong>Wallet Address:</strong> <code>${details.walletAddress || "N/A"}</code></div>
         <div class="detail-row"><strong>Network:</strong> ${details.network || "N/A"}</div>`
      : `<div class="detail-row"><strong>Bank Name:</strong> ${details.bankName || "N/A"}</div>
         <div class="detail-row"><strong>Account Name:</strong> ${details.accountName || "N/A"}</div>
         <div class="detail-row"><strong>Account Number:</strong> ${details.accountNumber || "N/A"}</div>
         ${details.routingNumber ? `<div class="detail-row"><strong>Routing:</strong> ${details.routingNumber}</div>` : ""}
         ${details.swiftCode ? `<div class="detail-row"><strong>SWIFT:</strong> ${details.swiftCode}</div>` : ""}`;

    const html = `
      <!DOCTYPE html><html><head><style>
        body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
        .container{max-width:600px;margin:0 auto;padding:20px}
        .header{background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:white;padding:25px 30px;border-radius:10px 10px 0 0}
        .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
        .box{background:#fff;border-left:4px solid #ef4444;padding:20px;margin:20px 0;border-radius:5px}
        .detail-row{padding:8px 0;border-bottom:1px solid #eee}
        .amount{font-size:28px;font-weight:bold;color:#ef4444;margin:15px 0}
        .action{background:#fef2f2;border:1px solid #fca5a5;padding:15px;margin:20px 0;border-radius:8px}
        code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;word-break:break-all}
        .footer{text-align:center;padding:20px;color:#666;font-size:12px}
      </style></head><body>
      <div class="container">
        <div class="header"><h2 style="margin:0">💸 Withdrawal Request</h2><p style="margin:5px 0 0">Action required: process and send funds</p></div>
        <div class="content">
          <p>A user has submitted a withdrawal request.</p>
          <div class="box">
            <div class="amount">$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="detail-row"><strong>Reference:</strong> ${reference}</div>
            <div class="detail-row"><strong>Method:</strong> ${methodLabel}</div>
            <div class="detail-row"><strong>User:</strong> ${userName} (${userEmail})</div>
            ${destinationHtml}
            <div class="detail-row"><strong>Submitted:</strong> ${new Date().toLocaleString()}</div>
          </div>
          <div class="action"><strong>⚡ Action Required:</strong>
            <ul style="margin:10px 0;padding-left:20px">
              <li>Verify user balance before processing</li>
              <li>Send funds to the ${method === "crypto" ? "wallet address" : "bank account"} above</li>
              <li>Include reference <strong>${reference}</strong> in transfer notes</li>
              <li>Update withdrawal status once sent</li>
            </ul>
          </div>
        </div>
        <div class="footer"><p>&copy; ${new Date().getFullYear()} ${emailConfig.appName} Admin Panel</p></div>
      </div></body></html>`;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Withdrawal] $${amount.toFixed(2)} via ${method === "crypto" ? (details.cryptoType as string) || "Crypto" : "Bank"} — ${reference}`,
      html,
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
    if (!adminEmail || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️  Admin email not configured, skipping receipt notification");
      return;
    }

    const methodLabel = method === "crypto" ? "Cryptocurrency" : method === "bank" ? "Bank Transfer" : "Card";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .receipt-box { background: #fff; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
          .amount { font-size: 28px; font-weight: bold; color: #10b981; margin: 15px 0; }
          .action-box { background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0">🧾 Payment Receipt Received</h2>
            <p style="margin:5px 0 0">A user has uploaded proof of payment</p>
          </div>
          <div class="content">
            <p>A payment receipt has been submitted for a pending deposit. Please verify and process accordingly.</p>

            <div class="receipt-box">
              <div class="amount">$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div class="detail-row"><strong>Reference:</strong> ${reference}</div>
              <div class="detail-row"><strong>Method:</strong> ${methodLabel}</div>
              <div class="detail-row"><strong>User:</strong> ${userName}</div>
              <div class="detail-row"><strong>Email:</strong> ${userEmail}</div>
              <div class="detail-row"><strong>File:</strong> ${fileName}</div>
              <div class="detail-row"><strong>Submitted:</strong> ${new Date().toLocaleString()}</div>
            </div>

            <div class="action-box">
              <strong>⚡ Action Required:</strong>
              <ul style="margin:10px 0;padding-left:20px">
                <li>Review the attached payment receipt</li>
                <li>Verify the transfer matches reference <strong>${reference}</strong></li>
                <li>Credit the user's account once confirmed</li>
                <li>Update deposit status to completed</li>
              </ul>
            </div>

            <p style="color:#666;font-size:13px">The receipt file is attached to this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName} Admin Panel</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: emailConfig.from,
      to: adminEmail,
      subject: `[Payment Receipt] $${amount.toFixed(2)} — ${reference}`,
      html,
      text: `Payment receipt uploaded\n\nReference: ${reference}\nAmount: $${amount.toFixed(2)}\nMethod: ${methodLabel}\nUser: ${userName} (${userEmail})\nFile: ${fileName}\nSubmitted: ${new Date().toLocaleString()}\n\nAction: review receipt and credit account.`,
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
          contentType: mimeType,
        },
      ],
    });

    console.log(`✅ Admin payment receipt notification sent to ${adminEmail} — ${reference}`);
  } catch (error) {
    console.error("Error sending admin receipt notification:", error);
  }
}

/**
 * Send transaction notification
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .transaction-box { background: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .amount { font-size: 32px; font-weight: bold; color: #667eea; margin: 20px 0; }
          .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Transaction Notification</h1>
            <p>${transactionType.replace("_", " ").toUpperCase()}</p>
          </div>
          <div class="content">
            <p>Hello ${user?.firstName || "User"},</p>
            <p>A transaction has been processed on your account.</p>

            <div class="transaction-box">
              <div class="amount">$${amount.toFixed(2)}</div>
              <div class="detail-row">
                <span>Type:</span>
                <span><strong>${transactionType.replace("_", " ").toUpperCase()}</strong></span>
              </div>
              <div class="detail-row">
                <span>Description:</span>
                <span>${description}</span>
              </div>
              <div class="detail-row">
                <span>Time:</span>
                <span>${new Date().toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span>New Balance:</span>
                <span><strong>$${(user?.balance || 0).toFixed(2)}</strong></span>
              </div>
            </div>

            <p>
              <a href="${emailConfig.appUrl}/dashboard/transactions"
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
                View Transaction History
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.</p>
            <p><a href="${emailConfig.appUrl}/dashboard/settings?tab=notifications">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `💳 ${transactionType.replace("_", " ").toUpperCase()} - $${amount.toFixed(2)}`,
        html,
      },
      NotificationType.EMAIL
    );

    // Also create in-app notification
    await createInAppNotification(
      userId,
      "transaction",
      `${transactionType.replace("_", " ").toUpperCase()}`,
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .transfer-box { background: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .amount { font-size: 32px; font-weight: bold; color: #ef4444; margin: 20px 0; text-align: center; }
          .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💸 Transfer Sent</h1>
            <p>Your money transfer was successful</p>
          </div>
          <div class="content">
            <p>Hello ${user?.firstName || "User"},</p>
            <p>You have successfully sent money to <strong>${recipientEmail}</strong>.</p>

            <div class="transfer-box">
              <div class="amount">-$${amount.toFixed(2)}</div>
              <div class="detail-row">
                <span>Recipient:</span>
                <span><strong>${recipientEmail}</strong></span>
              </div>
              <div class="detail-row">
                <span>Transfer ID:</span>
                <span>${transferId}</span>
              </div>
              <div class="detail-row">
                <span>Time:</span>
                <span>${new Date().toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span>New Balance:</span>
                <span><strong>$${newBalance.toFixed(2)}</strong></span>
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${emailConfig.appUrl}/dashboard/transfers" class="btn">
                View Transfer History
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `💸 Transfer Sent - $${amount.toFixed(2)}`,
        html,
        text: `Hello ${user?.firstName || "User"},\n\nYou have successfully sent money to ${recipientEmail}.\n\nAmount: -$${amount.toFixed(2)}\nRecipient: ${recipientEmail}\nTransfer ID: ${transferId}\nTime: ${new Date().toLocaleString()}\nNew Balance: $${newBalance.toFixed(2)}\n\nView your transfer history at: ${emailConfig.appUrl}/dashboard/transfers\n\n© ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.`,
      },
      NotificationType.EMAIL
    );

    // Create in-app notification
    await createInAppNotification(
      userId,
      "transfer",
      "Transfer Sent",
      `$${amount.toFixed(2)} sent to ${recipientEmail}`
    );
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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .transfer-box { background: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .amount { font-size: 32px; font-weight: bold; color: #10b981; margin: 20px 0; text-align: center; }
          .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Money Received</h1>
            <p>You've received a transfer</p>
          </div>
          <div class="content">
            <p>Hello ${user?.firstName || "User"},</p>
            <p>You have received money from <strong>${senderEmail}</strong>.</p>

            <div class="transfer-box">
              <div class="amount">+$${amount.toFixed(2)}</div>
              <div class="detail-row">
                <span>From:</span>
                <span><strong>${senderEmail}</strong></span>
              </div>
              <div class="detail-row">
                <span>Transfer ID:</span>
                <span>${transferId}</span>
              </div>
              <div class="detail-row">
                <span>Time:</span>
                <span>${new Date().toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span>New Balance:</span>
                <span><strong>$${newBalance.toFixed(2)}</strong></span>
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${emailConfig.appUrl}/dashboard/transfers" class="btn">
                View Transfer Details
              </a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailNotification(
      userId,
      {
        to: userEmail,
        subject: `💰 Money Received - $${amount.toFixed(2)}`,
        html,
        text: `Hello ${user?.firstName || "User"},\n\nYou have received money from ${senderEmail}.\n\nAmount: +$${amount.toFixed(2)}\nFrom: ${senderEmail}\nTransfer ID: ${transferId}\nTime: ${new Date().toLocaleString()}\nNew Balance: $${newBalance.toFixed(2)}\n\nView your transfer history at: ${emailConfig.appUrl}/dashboard/transfers\n\n© ${new Date().getFullYear()} ${emailConfig.appName}. All rights reserved.`,
      },
      NotificationType.EMAIL
    );

    // Create in-app notification
    await createInAppNotification(
      userId,
      "transfer",
      "Money Received",
      `$${amount.toFixed(2)} received from ${senderEmail}`
    );

    // Send real-time Socket.IO notification
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
    // Create in-app notification only (no email spam for failed transfers)
    await createInAppNotification(
      userId,
      "transfer",
      "Transfer Failed",
      `Transfer of $${amount.toFixed(2)} to ${recipientEmail} failed: ${reason}`
    );

    // Send real-time Socket.IO notification
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
