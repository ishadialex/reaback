import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import { sendContactFormToAdmin } from "../services/notification.service.js";

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
    if (message.length < 10) {
      return error(res, "Message must be at least 10 characters long", 400);
    }

    if (message.length > 5000) {
      return error(res, "Message is too long (max 5000 characters)", 400);
    }

    // Send contact form to admin asynchronously
    setImmediate(() => {
      sendContactFormToAdmin(
        name.trim(),
        email.toLowerCase().trim(),
        phone?.trim() || "Not provided",
        message.trim()
      ).catch((err) => console.error("Error sending contact form:", err));
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
