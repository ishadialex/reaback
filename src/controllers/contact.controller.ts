import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import { sendContactFormToAdmin } from "../services/notification.service.js";
import { sendWhatsAppMessage } from "../services/whatsapp.service.js";
import { env } from "../config/env.js";

/**
 * Submit contact form (Public endpoint)
 */
export async function submitContactForm(req: Request, res: Response) {
  try {
    const { name, email, phone, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return error(res, "Name, email, and message are required", 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error(res, "Invalid email address", 400);
    }

    // Validate message length
    if (message.length < 2) {
      return error(res, "Message is too short", 400);
    }

    if (message.length > 5000) {
      return error(res, "Message is too long (max 5000 characters)", 400);
    }

    const trimmedName    = name.trim();
    const trimmedEmail   = email.toLowerCase().trim();
    const trimmedPhone   = phone?.trim() || "Not provided";
    const trimmedMessage = message.trim();

    // Send contact form to admin via email (async)
    setImmediate(() => {
      sendContactFormToAdmin(trimmedName, trimmedEmail, trimmedPhone, trimmedMessage)
        .catch((err) => console.error("Error sending contact form email:", err));
    });

    // Send contact form to admin via WhatsApp (async)
    setImmediate(() => {
      const adminJids = (env.ADMIN_WA_JID || "").split(",").map((j) => j.trim()).filter(Boolean);
      if (adminJids.length === 0) return;
      const waText =
        `📋 *Offline Contact Form*\n` +
        `👤 *Name:* ${trimmedName}\n` +
        `📧 *Email:* ${trimmedEmail}\n` +
        `📞 *Phone:* ${trimmedPhone}\n\n` +
        `💬 *Message:*\n${trimmedMessage}`;
      for (const jid of adminJids) {
        sendWhatsAppMessage(jid, waText).catch((err) => console.error("Error sending contact WA:", err));
      }
    });

    return success(
      res,
      null,
      "Thank you for contacting us! We'll get back to you soon."
    );
  } catch (err) {
    console.error("Contact form submission error:", err);
    return error(res, "Failed to submit contact form", 500);
  }
}
