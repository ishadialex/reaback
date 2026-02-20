import { createTransport } from "nodemailer";

// Create reusable transporter
// Using Gmail SMTP: smtp.gmail.com:587 (STARTTLS)
// SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false
// SMTP_USER=your-gmail@gmail.com, SMTP_PASS=your-16-char-app-password
export const transporter = createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // false for port 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Generous timeouts — Gmail connects reliably from any server
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 30000, // 30 seconds for large emails
});

// Verify connection configuration (async, non-blocking)
transporter.verify().then(() => {
  console.log("✅ Email server is ready to send messages");
}).catch((error) => {
  console.log("⚠️  Email server connection warning:", error.message);
  console.log("📧 Emails will be attempted but may fail");
});

export const emailConfig = {
  from: process.env.EMAIL_FROM || "noreply@alvarado.com",
  appName: process.env.APP_NAME || "Alvarado Investment",
  appUrl: process.env.APP_URL || "http://localhost:3000",
};
