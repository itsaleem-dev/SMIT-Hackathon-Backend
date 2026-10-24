import express from "express";
import {
  adminDashboard,
  hrDashboard,
  employeeDashboard,
} from "../controllers/dashboardController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/admin", allowRoles("admin"), adminDashboard);
router.get("/hr", allowRoles("hr", "admin"), hrDashboard);
router.get("/employee", employeeDashboard);

export default router;