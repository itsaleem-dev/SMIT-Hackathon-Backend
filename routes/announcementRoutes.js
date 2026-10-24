import express from "express";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcementController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getAnnouncements);

router.post("/", allowRoles("admin", "hr"), createAnnouncement);
router.put("/:id", allowRoles("admin", "hr"), updateAnnouncement);
router.patch("/:id", allowRoles("admin", "hr"), updateAnnouncement);
router.delete("/:id", allowRoles("admin", "hr"), deleteAnnouncement);

export default router;