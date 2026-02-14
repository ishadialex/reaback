import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

// ── Public ──────────────────────────────────────────────────────────────────

/** GET /api/public/properties/:propertyId/reviews
 *  Returns approved reviews for a property (no auth required).
 */
export async function getPublicReviews(req: Request, res: Response) {
  try {
    const { propertyId } = req.params;

    const reviews = await prisma.propertyReview.findMany({
      where: { propertyId },
      include: {
        user: { select: { firstName: true, lastName: true, profilePhoto: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const avgRating =
      reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : 0;

    return success(res, { reviews: reviews.map(mapReview), avgRating, total: reviews.length });
  } catch (err) {
    return error(res, "Failed to fetch reviews", 500);
  }
}

// ── Authenticated ────────────────────────────────────────────────────────────

/** POST /api/reviews/:propertyId
 *  Logged-in user submits a review. One review per user per property.
 */
export async function createReview(req: Request, res: Response) {
  try {
    const { propertyId } = req.params;
    const { rating, title = "", body } = req.body;
    const userId = req.userId!;

    if (!body || typeof body !== "string" || body.trim().length < 5) {
      return error(res, "Review body must be at least 5 characters", 400);
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return error(res, "Rating must be an integer between 1 and 5", 400);
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId, isActive: true } });
    if (!property) return error(res, "Property not found", 404);

    const existing = await prisma.propertyReview.findUnique({
      where: { propertyId_userId: { propertyId, userId } },
    });
    if (existing) return error(res, "You have already reviewed this property", 409);

    const review = await prisma.propertyReview.create({
      data: { propertyId, userId, rating: ratingNum, title: title.trim(), body: body.trim() },
      include: {
        user: { select: { firstName: true, lastName: true, profilePhoto: true } },
      },
    });

    return success(res, mapReview(review), 201);
  } catch (err) {
    return error(res, "Failed to submit review", 500);
  }
}

/** PUT /api/reviews/:reviewId
 *  Owner can edit their own review (resets approval).
 */
export async function updateReview(req: Request, res: Response) {
  try {
    const { reviewId } = req.params;
    const { rating, title, body } = req.body;
    const userId = req.userId!;

    const existing = await prisma.propertyReview.findUnique({ where: { id: reviewId } });
    if (!existing) return error(res, "Review not found", 404);
    if (existing.userId !== userId) return error(res, "Not authorised", 403);

    const data: Record<string, unknown> = { isApproved: false }; // reset on edit
    if (body !== undefined) {
      if (typeof body !== "string" || body.trim().length < 5)
        return error(res, "Review body must be at least 5 characters", 400);
      data.body = body.trim();
    }
    if (rating !== undefined) {
      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5)
        return error(res, "Rating must be an integer between 1 and 5", 400);
      data.rating = ratingNum;
    }
    if (title !== undefined) data.title = String(title).trim();

    const updated = await prisma.propertyReview.update({
      where: { id: reviewId },
      data,
      include: {
        user: { select: { firstName: true, lastName: true, profilePhoto: true } },
      },
    });

    return success(res, mapReview(updated));
  } catch (err) {
    return error(res, "Failed to update review", 500);
  }
}

/** DELETE /api/reviews/:reviewId
 *  Owner or admin can delete a review.
 */
export async function deleteReview(req: Request, res: Response) {
  try {
    const { reviewId } = req.params;
    const userId = req.userId!;
    const userRole = (req as any).userRole ?? "user";

    const existing = await prisma.propertyReview.findUnique({ where: { id: reviewId } });
    if (!existing) return error(res, "Review not found", 404);
    if (existing.userId !== userId && userRole !== "admin" && userRole !== "superadmin") {
      return error(res, "Not authorised", 403);
    }

    await prisma.propertyReview.delete({ where: { id: reviewId } });
    return success(res, { message: "Review deleted" });
  } catch (err) {
    return error(res, "Failed to delete review", 500);
  }
}

/** GET /api/reviews/my
 *  Logged-in user gets their own reviews (pending + approved).
 */
export async function getMyReviews(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const reviews = await prisma.propertyReview.findMany({
      where: { userId },
      include: {
        property: { select: { id: true, title: true, images: true, location: true } },
        user: { select: { firstName: true, lastName: true, profilePhoto: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return success(res, reviews.map(mapReview));
  } catch (err) {
    return error(res, "Failed to fetch your reviews", 500);
  }
}

// ── All Reviews (public, no auth) ────────────────────────────────────────────

/** GET /api/public/reviews
 *  Returns all reviews across all properties (no auth required).
 */
export async function getAllPublicReviews(req: Request, res: Response) {
  try {
    const reviews = await prisma.propertyReview.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, profilePhoto: true } },
        property: { select: { id: true, title: true, location: true, images: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return success(res, reviews.map(mapReview));
  } catch (err) {
    return error(res, "Failed to fetch reviews", 500);
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** GET /api/reviews/admin/all
 *  Admin gets all reviews (pending + approved).
 */
export async function getAllReviews(req: Request, res: Response) {
  try {
    const { approved } = req.query;

    const where: Record<string, unknown> = {};
    if (approved === "true") where.isApproved = true;
    if (approved === "false") where.isApproved = false;

    const reviews = await prisma.propertyReview.findMany({
      where,
      include: {
        property: { select: { id: true, title: true, location: true } },
        user: { select: { firstName: true, lastName: true, email: true, profilePhoto: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return success(res, reviews.map(mapReview));
  } catch (err) {
    return error(res, "Failed to fetch reviews", 500);
  }
}

/** PATCH /api/reviews/admin/:reviewId/approve
 *  Admin approves or rejects a review.
 */
export async function approveReview(req: Request, res: Response) {
  try {
    const { reviewId } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== "boolean") {
      return error(res, "isApproved must be a boolean", 400);
    }

    const review = await prisma.propertyReview.update({
      where: { id: reviewId },
      data: { isApproved },
    });

    return success(res, { id: review.id, isApproved: review.isApproved });
  } catch (err) {
    return error(res, "Failed to update review approval", 500);
  }
}

// ── Helper ───────────────────────────────────────────────────────────────────

function mapReview(r: any) {
  return {
    id: r.id,
    propertyId: r.propertyId,
    property: r.property ?? undefined,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isApproved: r.isApproved,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    user: r.user
      ? {
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          profilePhoto: r.user.profilePhoto ?? null,
          email: r.user.email ?? undefined,
        }
      : undefined,
  };
}
