import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotification,
} from "../controllers/notificationController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);
router.post("/", allowRoles("admin", "hr"), sendNotification);

// "read-all" ko "/:id" se pehle rakhna zaroori hai
router.patch("/read-all", markAllAsRead);
router.put("/read-all", markAllAsRead);

router.patch("/:id/read", markAsRead);
router.put("/:id/read", markAsRead);

router.delete("/:id", deleteNotification);

export default router;