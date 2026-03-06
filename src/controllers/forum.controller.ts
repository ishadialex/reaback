import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
};

// ──────────────────────────────────────────────
// Posts
// ──────────────────────────────────────────────

// GET /api/forum/posts?page=1&limit=20
export async function listPosts(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      where: { isDeleted: false },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        author: { select: AUTHOR_SELECT },
        comments: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.forumPost.count({ where: { isDeleted: false } }),
  ]);

  let likedPostIds = new Set<string>();
  if (req.userId && posts.length > 0) {
    const likes = await prisma.forumLike.findMany({
      where: { userId: req.userId, postId: { in: posts.map(p => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map(l => l.postId!));
  }

  const postsWithLike = posts.map(({ comments, ...p }) => ({
    ...p,
    isLikedByUser: likedPostIds.has(p.id),
    lastCommentAt: p.lastCommentAt ?? comments[0]?.createdAt ?? null,
  }));
  return success(res, { posts: postsWithLike, total, page, pages: Math.ceil(total / limit) });
}

// GET /api/forum/posts/:id?page=1&limit=20
export async function getPost(req: Request, res: Response) {
  const post = await prisma.forumPost.findFirst({
    where: { id: req.params.id as string, isDeleted: false },
    include: { author: { select: AUTHOR_SELECT } },
  });

  if (!post) return error(res, "Post not found", 404);

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  // Fetch top-level comments only (replies are loaded separately per comment)
  const [comments, total] = await Promise.all([
    prisma.forumComment.findMany({
      where: { postId: post.id, parentId: null, isDeleted: false },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      include: { author: { select: AUTHOR_SELECT } },
    }),
    prisma.forumComment.count({ where: { postId: post.id, parentId: null, isDeleted: false } }),
  ]);

  // Count replies for each top-level comment so the frontend can show the "View N replies" button immediately
  const allReplies = await prisma.forumComment.findMany({
    where: { postId: post.id, parentId: { not: null }, isDeleted: false },
    select: { parentId: true },
  });
  const replyCounts: Record<string, number> = {};
  for (const r of allReplies) {
    if (r.parentId) replyCounts[r.parentId] = (replyCounts[r.parentId] || 0) + 1;
  }
  let likedPostIds = new Set<string>();
  let likedCommentIds = new Set<string>();
  if (req.userId) {
    const [postLikes, commentLikes] = await Promise.all([
      prisma.forumLike.findMany({
        where: { userId: req.userId, postId: post.id },
        select: { postId: true },
      }),
      prisma.forumLike.findMany({
        where: { userId: req.userId, commentId: { in: comments.map(c => c.id) } },
        select: { commentId: true },
      }),
    ]);
    likedPostIds = new Set(postLikes.map(l => l.postId!));
    likedCommentIds = new Set(commentLikes.map(l => l.commentId!));
  }

  const commentsWithCount = comments.map(c => ({
    ...c,
    repliesCount: replyCounts[c.id] ?? 0,
    isLikedByUser: likedCommentIds.has(c.id),
  }));

  return success(res, {
    post: { ...post, isLikedByUser: likedPostIds.has(post.id) },
    comments: commentsWithCount,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// POST /api/forum/posts
export async function createPost(req: Request, res: Response) {
  const { title, content } = req.body;
  if (!title?.trim()) return error(res, "Title is required", 400);
  if (!content?.trim()) return error(res, "Content is required", 400);

  const files = req.files as Express.Multer.File[];
  const images = files?.map((f: any) => f.path) ?? [];

  const post = await prisma.forumPost.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      images,
      authorId: req.userId!,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return success(res, { post }, undefined, 201);
}

// PATCH /api/forum/posts/:id
export async function updatePost(req: Request, res: Response) {
  const post = await prisma.forumPost.findFirst({
    where: { id: req.params.id as string, isDeleted: false },
  });
  if (!post) return error(res, "Post not found", 404);
  if (post.authorId !== req.userId) return error(res, "You can only edit your own posts", 403);

  const { title, content } = req.body;
  const files = req.files as Express.Multer.File[];
  const newImages = files?.map((f: any) => f.path) ?? [];

  const updated = await prisma.forumPost.update({
    where: { id: post.id },
    data: {
      ...(title?.trim() && { title: title.trim() }),
      ...(content?.trim() && { content: content.trim() }),
      ...(newImages.length > 0 && { images: newImages }),
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return success(res, { post: updated });
}

// DELETE /api/forum/posts/:id
export async function deletePost(req: Request, res: Response) {
  const post = await prisma.forumPost.findFirst({
    where: { id: req.params.id as string, isDeleted: false },
  });
  if (!post) return error(res, "Post not found", 404);
  if (post.authorId !== req.userId) return error(res, "You can only delete your own posts", 403);

  await prisma.forumPost.update({ where: { id: post.id }, data: { isDeleted: true } });
  return success(res, { message: "Post deleted" });
}

// ──────────────────────────────────────────────
// Comments
// ──────────────────────────────────────────────

// POST /api/forum/posts/:id/comments
export async function createComment(req: Request, res: Response) {
  const { content } = req.body;
  if (!content?.trim()) return error(res, "Content is required", 400);

  const post = await prisma.forumPost.findFirst({ where: { id: req.params.id as string, isDeleted: false } });
  if (!post) return error(res, "Post not found", 404);

  const files = req.files as Express.Multer.File[];
  const images = files?.map((f: any) => f.path) ?? [];

  const comment = await prisma.forumComment.create({
    data: {
      content: content.trim(),
      images,
      authorId: req.userId!,
      postId: post.id,
      parentId: null,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  await prisma.forumPost.update({
    where: { id: post.id },
    data: { commentsCount: { increment: 1 }, lastCommentAt: new Date() },
  });

  return success(res, { comment }, undefined, 201);
}

// GET /api/forum/comments/:id/replies?page=1&limit=20
export async function getReplies(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [replies, total] = await Promise.all([
    prisma.forumComment.findMany({
      where: { parentId: req.params.id as string, isDeleted: false },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
      include: { author: { select: AUTHOR_SELECT } },
    }),
    prisma.forumComment.count({ where: { parentId: req.params.id as string, isDeleted: false } }),
  ]);

  return success(res, { replies, total, page, pages: Math.ceil(total / limit) });
}

// POST /api/forum/comments/:id/replies
// Depth-1 enforced: parentId always points to the root comment
export async function createReply(req: Request, res: Response) {
  const { content } = req.body;
  if (!content?.trim()) return error(res, "Content is required", 400);

  const targetComment = await prisma.forumComment.findFirst({
    where: { id: req.params.id as string, isDeleted: false },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!targetComment) return error(res, "Comment not found", 404);

  const files = req.files as Express.Multer.File[];
  const images = files?.map((f: any) => f.path) ?? [];

  // If replying to a reply, parentId still points to the root comment (depth-1 enforced)
  const rootParentId = targetComment.parentId ?? targetComment.id;

  const reply = await prisma.forumComment.create({
    data: {
      content: content.trim(),
      images,
      authorId: req.userId!,
      postId: targetComment.postId,
      parentId: rootParentId,
      replyToId: targetComment.id,
      replyToName: `${targetComment.author.firstName} ${targetComment.author.lastName}`,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  await prisma.forumPost.update({
    where: { id: targetComment.postId },
    data: { commentsCount: { increment: 1 }, lastCommentAt: new Date() },
  });

  return success(res, { reply }, undefined, 201);
}

// PATCH /api/forum/comments/:id
export async function updateComment(req: Request, res: Response) {
  const comment = await prisma.forumComment.findFirst({
    where: { id: req.params.id as string, isDeleted: false },
  });
  if (!comment) return error(res, "Comment not found", 404);
  if (comment.authorId !== req.userId) return error(res, "You can only edit your own comments", 403);

  const { content } = req.body;
  const files = req.files as Express.Multer.File[];
  const newImages = files?.map((f: any) => f.path) ?? [];

  const updated = await prisma.forumComment.update({
    where: { id: comment.id },
    data: {
      ...(content?.trim() && { content: content.trim() }),
      ...(newImages.length > 0 && { images: newImages }),
    },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return success(res, { comment: updated });
}

// DELETE /api/forum/comments/:id
export async function deleteComment(req: Request, res: Response) {
  const comment = await prisma.forumComment.findFirst({
    where: { id: req.params.id as string, isDeleted: false },
  });
  if (!comment) return error(res, "Comment not found", 404);
  if (comment.authorId !== req.userId) return error(res, "You can only delete your own comments", 403);

  await prisma.forumComment.update({ where: { id: comment.id }, data: { isDeleted: true } });
  await prisma.forumPost.update({
    where: { id: comment.postId },
    data: { commentsCount: { decrement: 1 } },
  });

  return success(res, { message: "Comment deleted" });
}

// ──────────────────────────────────────────────
// Likes
// ──────────────────────────────────────────────

// POST /api/forum/posts/:id/like  — toggle
export async function togglePostLike(req: Request, res: Response) {
  const post = await prisma.forumPost.findFirst({ where: { id: req.params.id as string, isDeleted: false } });
  if (!post) return error(res, "Post not found", 404);

  const existing = await prisma.forumLike.findFirst({
    where: { userId: req.userId!, postId: post.id },
  });

  if (existing) {
    await prisma.forumLike.delete({ where: { id: existing.id } });
    await prisma.forumPost.update({ where: { id: post.id }, data: { likesCount: { decrement: 1 } } });
    return success(res, { liked: false });
  }

  await prisma.forumLike.create({ data: { userId: req.userId!, postId: post.id } });
  await prisma.forumPost.update({ where: { id: post.id }, data: { likesCount: { increment: 1 } } });
  return success(res, { liked: true });
}

// POST /api/forum/comments/:id/like  — toggle
export async function toggleCommentLike(req: Request, res: Response) {
  const comment = await prisma.forumComment.findFirst({ where: { id: req.params.id as string, isDeleted: false } });
  if (!comment) return error(res, "Comment not found", 404);

  const existing = await prisma.forumLike.findFirst({
    where: { userId: req.userId!, commentId: comment.id },
  });

  if (existing) {
    await prisma.forumLike.delete({ where: { id: existing.id } });
    await prisma.forumComment.update({ where: { id: comment.id }, data: { likesCount: { decrement: 1 } } });
    return success(res, { liked: false });
  }

  await prisma.forumLike.create({ data: { userId: req.userId!, commentId: comment.id } });
  await prisma.forumComment.update({ where: { id: comment.id }, data: { likesCount: { increment: 1 } } });
  return success(res, { liked: true });
}
