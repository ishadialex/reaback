import { createTransport } from "nodemailer";

// Create reusable transporter
export const transporter = createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Add timeout to prevent hanging
  connectionTimeout: 5000, // 5 seconds
  greetingTimeout: 5000,
  socketTimeout: 5000,
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
