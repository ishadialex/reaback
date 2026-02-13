import { prisma } from "../config/database.js";
import { sendNewsletterWelcomeEmail } from "./notification.service.js";

/**
 * Subscribe a user to the newsletter
 */
export async function subscribeToNewsletter(
  email: string,
  firstName?: string,
  lastName?: string,
  source: string = "website"
): Promise<{ success: boolean; message: string; isNewSubscriber: boolean }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if subscriber already exists
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // If already subscribed, just return success
      if (existing.isSubscribed) {
        return {
          success: true,
          message: "You are already subscribed to our newsletter",
          isNewSubscriber: false,
        };
      }

      // Re-subscribe if previously unsubscribed
      await prisma.newsletterSubscriber.update({
        where: { email: normalizedEmail },
        data: {
          isSubscribed: true,
          subscribedAt: new Date(),
          unsubscribedAt: null,
          firstName: firstName || existing.firstName,
          lastName: lastName || existing.lastName,
          source,
        },
      });

      // Send welcome email asynchronously (re-subscription)
      setImmediate(() => {
        sendNewsletterWelcomeEmail(normalizedEmail, firstName || existing.firstName)
          .catch((err) => console.error("Error sending newsletter welcome email:", err));
      });

      return {
        success: true,
        message: "You have been re-subscribed to our newsletter",
        isNewSubscriber: false,
      };
    }

    // Create new subscriber
    await prisma.newsletterSubscriber.create({
      data: {
        email: normalizedEmail,
        firstName: firstName || "",
        lastName: lastName || "",
        source,
        isSubscribed: true,
      },
    });

    // Send welcome email asynchronously (new subscriber)
    setImmediate(() => {
      sendNewsletterWelcomeEmail(normalizedEmail, firstName)
        .catch((err) => console.error("Error sending newsletter welcome email:", err));
    });

    return {
      success: true,
      message: "Successfully subscribed to our newsletter",
      isNewSubscriber: true,
    };
  } catch (error) {
    console.error("Error subscribing to newsletter:", error);
    throw new Error("Failed to subscribe to newsletter");
  }
}

/**
 * Unsubscribe a user from the newsletter
 */
export async function unsubscribeFromNewsletter(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (!subscriber) {
      return {
        success: false,
        message: "Email not found in our newsletter list",
      };
    }

    if (!subscriber.isSubscribed) {
      return {
        success: true,
        message: "You are already unsubscribed",
      };
    }

    await prisma.newsletterSubscriber.update({
      where: { email: normalizedEmail },
      data: {
        isSubscribed: false,
        unsubscribedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "Successfully unsubscribed from our newsletter",
    };
  } catch (error) {
    console.error("Error unsubscribing from newsletter:", error);
    throw new Error("Failed to unsubscribe from newsletter");
  }
}

/**
 * Get all newsletter subscribers
 */
export async function getAllSubscribers(
  includeUnsubscribed: boolean = false
) {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: includeUnsubscribed ? {} : { isSubscribed: true },
      orderBy: { subscribedAt: "desc" },
    });

    return subscribers;
  } catch (error) {
    console.error("Error fetching newsletter subscribers:", error);
    throw new Error("Failed to fetch newsletter subscribers");
  }
}

/**
 * Get subscriber count
 */
export async function getSubscriberCount(): Promise<{
  total: number;
  subscribed: number;
  unsubscribed: number;
}> {
  try {
    const [total, subscribed] = await Promise.all([
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { isSubscribed: true } }),
    ]);

    return {
      total,
      subscribed,
      unsubscribed: total - subscribed,
    };
  } catch (error) {
    console.error("Error getting subscriber count:", error);
    throw new Error("Failed to get subscriber count");
  }
}

/**
 * Export subscribers to CSV format
 */
export function exportSubscribersToCSV(
  subscribers: Array<{
    email: string;
    firstName: string;
    lastName: string;
    isSubscribed: boolean;
    subscribedAt: Date;
    unsubscribedAt: Date | null;
    source: string;
  }>
): string {
  // CSV header
  const headers = [
    "Email",
    "First Name",
    "Last Name",
    "Status",
    "Subscribed At",
    "Unsubscribed At",
    "Source",
  ];

  // CSV rows
  const rows = subscribers.map((subscriber) => [
    subscriber.email,
    subscriber.firstName,
    subscriber.lastName,
    subscriber.isSubscribed ? "Subscribed" : "Unsubscribed",
    subscriber.subscribedAt.toISOString(),
    subscriber.unsubscribedAt ? subscriber.unsubscribedAt.toISOString() : "",
    subscriber.source,
  ]);

  // Convert to CSV string
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma or quote
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(",")
    ),
  ].join("\n");

  return csvContent;
}

/**
 * Delete a subscriber permanently
 */
export async function deleteSubscriber(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (!subscriber) {
      return {
        success: false,
        message: "Subscriber not found",
      };
    }

    await prisma.newsletterSubscriber.delete({
      where: { email: normalizedEmail },
    });

    return {
      success: true,
      message: "Subscriber deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    throw new Error("Failed to delete subscriber");
  }
}
