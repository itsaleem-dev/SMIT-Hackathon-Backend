import express from "express";
import {
  getLeaves,
  getMyLeaves,
  getMyBalance,
  applyLeave,
  approveLeave,
  rejectLeave,
  decideLeave,
  cancelLeave,
} from "../controllers/leaveController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getLeaves);
router.post("/", applyLeave);

// "/my" aur "/balance" ko "/:id" wale routes se pehle rakhna zaroori hai
router.get("/my", getMyLeaves);
router.get("/balance", getMyBalance);

router.post("/:id/approve", allowRoles("admin", "hr"), approveLeave);
router.patch("/:id/approve", allowRoles("admin", "hr"), approveLeave);
router.put("/:id/approve", allowRoles("admin", "hr"), approveLeave);
router.post("/:id/reject", allowRoles("admin", "hr"), rejectLeave);
router.patch("/:id/reject", allowRoles("admin", "hr"), rejectLeave);
router.put("/:id/reject", allowRoles("admin", "hr"), rejectLeave);

router.patch("/:id/cancel", cancelLeave);
router.post("/:id/cancel", cancelLeave);
router.delete("/:id", cancelLeave);

router.patch("/:id", allowRoles("admin", "hr"), decideLeave);
router.put("/:id", allowRoles("admin", "hr"), decideLeave);

export default router;