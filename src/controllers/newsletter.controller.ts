import { Request, Response } from "express";
import { success, error } from "../utils/response.js";
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getAllSubscribers,
  getSubscriberCount,
  exportSubscribersToCSV,
  deleteSubscriber,
} from "../services/newsletter.service.js";

/**
 * Subscribe to newsletter (Public endpoint)
 */
export async function subscribe(req: Request, res: Response) {
  try {
    const { email, firstName, lastName, source } = req.body;

    if (!email) {
      return error(res, "Email is required", 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error(res, "Invalid email address", 400);
    }

    const result = await subscribeToNewsletter(
      email,
      firstName,
      lastName,
      source || "website"
    );

    return success(
      res,
      {
        isNewSubscriber: result.isNewSubscriber,
      },
      result.message
    );
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return error(res, "Failed to subscribe to newsletter", 500);
  }
}

/**
 * Unsubscribe from newsletter (Public endpoint)
 */
export async function unsubscribe(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, "Email is required", 400);
    }

    const result = await unsubscribeFromNewsletter(email);

    if (!result.success) {
      return error(res, result.message, 404);
    }

    return success(res, null, result.message);
  } catch (err) {
    console.error("Newsletter unsubscribe error:", err);
    return error(res, "Failed to unsubscribe from newsletter", 500);
  }
}

/**
 * Get all subscribers (Admin only)
 */
export async function getSubscribers(req: Request, res: Response) {
  try {
    const includeUnsubscribed = req.query.includeUnsubscribed === "true";

    const subscribers = await getAllSubscribers(includeUnsubscribed);
    const count = await getSubscriberCount();

    return success(res, {
      subscribers,
      count,
    });
  } catch (err) {
    console.error("Get subscribers error:", err);
    return error(res, "Failed to fetch subscribers", 500);
  }
}

/**
 * Export subscribers to CSV (Admin only)
 */
export async function exportCSV(req: Request, res: Response) {
  try {
    const includeUnsubscribed = req.query.includeUnsubscribed === "true";

    const subscribers = await getAllSubscribers(includeUnsubscribed);
    const csvContent = exportSubscribersToCSV(subscribers);

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=newsletter-subscribers-${new Date().toISOString().split("T")[0]}.csv`
    );

    return res.send(csvContent);
  } catch (err) {
    console.error("Export CSV error:", err);
    return error(res, "Failed to export subscribers", 500);
  }
}

/**
 * Get subscriber statistics (Admin only)
 */
export async function getStats(req: Request, res: Response) {
  try {
    const count = await getSubscriberCount();

    return success(res, count);
  } catch (err) {
    console.error("Get stats error:", err);
    return error(res, "Failed to fetch statistics", 500);
  }
}

/**
 * Delete a subscriber (Admin only)
 */
export async function removeSubscriber(req: Request, res: Response) {
  try {
    const { email } = req.params;

    if (!email) {
      return error(res, "Email is required", 400);
    }

    const result = await deleteSubscriber(email);

    if (!result.success) {
      return error(res, result.message, 404);
    }

    return success(res, null, result.message);
  } catch (err) {
    console.error("Delete subscriber error:", err);
    return error(res, "Failed to delete subscriber", 500);
  }
}
