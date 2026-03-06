import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  profilePhoto: true,
};

// GET /api/admin/forum/posts — list all posts (including deleted)
export async function adminListPosts(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { author: { select: AUTHOR_SELECT } },
    }),
    prisma.forumPost.count(),
  ]);

  return success(res, { posts, total, page, pages: Math.ceil(total / limit) });
}

// PATCH /api/admin/forum/posts/:id — edit post fields + override createdAt/updatedAt
export async function adminEditPost(req: Request, res: Response) {
  const { title, content, createdAt, updatedAt } = req.body;

  const post = await prisma.forumPost.findUnique({ where: { id: req.params.id as string } });
  if (!post) return error(res, "Post not found", 404);

  const hasDateOverride = createdAt || updatedAt;

  if (hasDateOverride) {
    // Use raw command so we can override @updatedAt managed by Prisma
    const setFields: Record<string, any> = {};
    if (title?.trim()) setFields.title = title.trim();
    if (content?.trim() !== undefined) setFields.content = content.trim();
    if (createdAt) setFields.createdAt = { $date: new Date(createdAt).toISOString() };
    if (updatedAt) setFields.updatedAt = { $date: new Date(updatedAt).toISOString() };

    await prisma.$runCommandRaw({
      update: "ForumPost",
      updates: [{ q: { _id: { $oid: post.id } }, u: { $set: setFields } }],
    });
  } else {
    await prisma.forumPost.update({
      where: { id: post.id },
      data: {
        ...(title?.trim() && { title: title.trim() }),
        ...(content?.trim() !== undefined && { content: content.trim() }),
      },
    });
  }

  const updated = await prisma.forumPost.findUnique({
    where: { id: post.id },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return success(res, { post: updated });
}

// DELETE /api/admin/forum/posts/:id — hard delete post + all its comments/likes
export async function adminDeletePost(req: Request, res: Response) {
  const post = await prisma.forumPost.findUnique({ where: { id: req.params.id as string } });
  if (!post) return error(res, "Post not found", 404);

  await prisma.forumPost.delete({ where: { id: post.id } });
  return success(res, { message: "Post permanently deleted" });
}

// GET /api/admin/forum/posts/:id/comments — list all comments + replies for a post
export async function adminGetPostComments(req: Request, res: Response) {
  const id = req.params.id as string;
  const post = await prisma.forumPost.findUnique({ where: { id } });
  if (!post) return error(res, "Post not found", 404);

  const comments = await prisma.forumComment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return success(res, { comments });
}

// PATCH /api/admin/forum/comments/:id — edit comment fields + override createdAt/updatedAt
export async function adminEditComment(req: Request, res: Response) {
  const { content, createdAt, updatedAt } = req.body;

  const comment = await prisma.forumComment.findUnique({ where: { id: req.params.id as string } });
  if (!comment) return error(res, "Comment not found", 404);

  const hasDateOverride = createdAt || updatedAt;

  if (hasDateOverride) {
    const setFields: Record<string, any> = {};
    if (content?.trim()) setFields.content = content.trim();
    if (createdAt) setFields.createdAt = { $date: new Date(createdAt).toISOString() };
    if (updatedAt) setFields.updatedAt = { $date: new Date(updatedAt).toISOString() };

    await prisma.$runCommandRaw({
      update: "ForumComment",
      updates: [{ q: { _id: { $oid: comment.id } }, u: { $set: setFields } }],
    });
  } else {
    await prisma.forumComment.update({
      where: { id: comment.id },
      data: { ...(content?.trim() && { content: content.trim() }) },
    });
  }

  const updated = await prisma.forumComment.findUnique({
    where: { id: comment.id },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return success(res, { comment: updated });
}

// DELETE /api/admin/forum/comments/:id — hard delete comment/reply
export async function adminDeleteComment(req: Request, res: Response) {
  const comment = await prisma.forumComment.findUnique({ where: { id: req.params.id as string } });
  if (!comment) return error(res, "Comment not found", 404);

  await prisma.forumComment.delete({ where: { id: comment.id } });

  // Adjust post comment count
  await prisma.forumPost.update({
    where: { id: comment.postId },
    data: { commentsCount: { decrement: 1 } },
  });

  return success(res, { message: "Comment permanently deleted" });
}

// PATCH /api/admin/forum/posts/:id/pin — toggle pin
export async function pinPost(req: Request, res: Response) {
  const post = await prisma.forumPost.findUnique({ where: { id: req.params.id as string } });
  if (!post) return error(res, "Post not found", 404);

  const updated = await prisma.forumPost.update({
    where: { id: post.id },
    data: { isPinned: !post.isPinned },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return success(res, { post: updated, pinned: updated.isPinned });
}
