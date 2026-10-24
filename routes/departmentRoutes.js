import express from "express";
import {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getDepartments);
router.get("/:id", getDepartment);

router.post("/", allowRoles("admin", "hr"), createDepartment);
router.put("/:id", allowRoles("admin", "hr"), updateDepartment);
router.patch("/:id", allowRoles("admin", "hr"), updateDepartment);
router.delete("/:id", allowRoles("admin", "hr"), deleteDepartment);

export default router;