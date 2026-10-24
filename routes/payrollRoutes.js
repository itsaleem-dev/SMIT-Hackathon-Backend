import express from "express";
import {
  generatePayroll,
  getPayroll,
  getSummary,
  updatePayslip,
  payPayslip,
  payMonth,
  deletePayslip,
  getMyPayslips,
  getPayslip,
} from "../controllers/payrollController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Employee apni payslips yahan se dekhta hai (sab logged-in users)
router.get("/my", getMyPayslips);
router.get("/payslips", getMyPayslips);
router.get("/payslips/:id", getPayslip);

// Baaqi sab sirf admin/hr
router.use(allowRoles("admin", "hr"));

router.get("/", getPayroll);
router.get("/summary", getSummary);
router.post("/generate", generatePayroll);
router.post("/pay", payMonth);

router.post("/:id/pay", payPayslip);
router.patch("/:id/pay", payPayslip);
router.patch("/:id", updatePayslip);
router.put("/:id", updatePayslip);
router.delete("/:id", deletePayslip);

export default router;