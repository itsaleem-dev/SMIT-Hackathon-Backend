import express from "express";
import {
  getToday,
  checkIn,
  checkOut,
  getMyAttendance,
  getAttendance,
  getBoard,
} from "../controllers/attendanceController.js";
import {
  getCorrections,
  createCorrection,
  approveCorrection,
  rejectCorrection,
  decideCorrection,
} from "../controllers/correctionController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Har logged-in user
router.get("/today", getToday);
router.get("/my", getMyAttendance);
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);

// Corrections (employee apni dekhta hai, admin/hr sab)
router.get("/corrections", getCorrections);
router.post("/corrections", createCorrection);
router.post("/corrections/:id/approve", allowRoles("admin", "hr"), approveCorrection);
router.patch("/corrections/:id/approve", allowRoles("admin", "hr"), approveCorrection);
router.put("/corrections/:id/approve", allowRoles("admin", "hr"), approveCorrection);
router.post("/corrections/:id/reject", allowRoles("admin", "hr"), rejectCorrection);
router.patch("/corrections/:id/reject", allowRoles("admin", "hr"), rejectCorrection);
router.put("/corrections/:id/reject", allowRoles("admin", "hr"), rejectCorrection);
router.patch("/corrections/:id", allowRoles("admin", "hr"), decideCorrection);
router.put("/corrections/:id", allowRoles("admin", "hr"), decideCorrection);

// Sirf admin/hr
router.get("/board", allowRoles("admin", "hr"), getBoard);
router.get("/", allowRoles("admin", "hr"), getAttendance);

export default router;