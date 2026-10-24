import express from "express";
import {
  getEmployees,
  getMyEmployee,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "../controllers/employeeController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", allowRoles("admin", "hr"), getEmployees);
router.post("/", allowRoles("admin", "hr"), createEmployee);

// "/me" ko "/:id" se pehle rakhna zaroori hai
router.get("/me", getMyEmployee);

router.get("/:id", getEmployee); // admin/hr ya khud apna (controller check karta hai)
router.put("/:id", allowRoles("admin", "hr"), updateEmployee);
router.patch("/:id", allowRoles("admin", "hr"), updateEmployee);
router.delete("/:id", allowRoles("admin", "hr"), deactivateEmployee);

export default router;