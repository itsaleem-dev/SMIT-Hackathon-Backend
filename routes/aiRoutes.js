import express from "express";
import { chat, summary } from "../controllers/aiController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/chat", chat);
router.post("/summary", allowRoles("admin", "hr"), summary);
router.post("/insights", allowRoles("admin", "hr"), summary);

export default router;