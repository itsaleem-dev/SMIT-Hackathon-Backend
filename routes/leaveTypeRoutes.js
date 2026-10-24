import express from "express";
import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
} from "../controllers/leaveController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getLeaveTypes);
router.post("/", allowRoles("admin", "hr"), createLeaveType);
router.put("/:id", allowRoles("admin", "hr"), updateLeaveType);
router.patch("/:id", allowRoles("admin", "hr"), updateLeaveType);
router.delete("/:id", allowRoles("admin", "hr"), deleteLeaveType);

export default router;