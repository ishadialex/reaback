import { Router } from "express";
import { adminAuthFlexible } from "../../middleware/adminAuthFlexible.js";
import {
  adminListPosts,
  adminEditPost,
  adminDeletePost,
  adminGetPostComments,
  adminEditComment,
  adminDeleteComment,
  pinPost,
} from "../../controllers/admin/forum.controller.js";

const router = Router();

router.use(adminAuthFlexible);

router.get("/posts", adminListPosts);
router.patch("/posts/:id", adminEditPost);
router.delete("/posts/:id", adminDeletePost);
router.get("/posts/:id/comments", adminGetPostComments);
router.patch("/comments/:id", adminEditComment);
router.delete("/comments/:id", adminDeleteComment);
router.patch("/posts/:id/pin", pinPost);

export default router;
