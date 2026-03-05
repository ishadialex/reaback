import { Router, Request, Response, NextFunction } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { uploadForumImages } from "../middleware/upload.js";
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  createComment,
  getReplies,
  createReply,
  updateComment,
  deleteComment,
  togglePostLike,
  toggleCommentLike,
} from "../controllers/forum.controller.js";

const router = Router();

function handleForumUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) return next();
  uploadForumImages(req, res, (err: any) => {
    if (err) {
      if (err.code === "ECONNRESET" || err.message === "aborted") return;
      if (!res.headersSent)
        return res.status(400).json({ success: false, message: err.message || "Image upload failed" });
      return;
    }
    next();
  });
}

// ── Public (with optional auth to return isLikedByUser) ─────────
router.get("/posts", optionalAuthenticate, listPosts);
router.get("/posts/:id", optionalAuthenticate, getPost);
router.get("/comments/:id/replies", getReplies);

// ── Authenticated ────────────────────────────────────
router.post("/posts", authenticate, handleForumUpload, createPost);
router.patch("/posts/:id", authenticate, handleForumUpload, updatePost);
router.delete("/posts/:id", authenticate, deletePost);

router.post("/posts/:id/comments", authenticate, handleForumUpload, createComment);
router.post("/comments/:id/replies", authenticate, handleForumUpload, createReply);
router.patch("/comments/:id", authenticate, handleForumUpload, updateComment);
router.delete("/comments/:id", authenticate, deleteComment);

router.post("/posts/:id/like", authenticate, togglePostLike);
router.post("/comments/:id/like", authenticate, toggleCommentLike);

export default router;
