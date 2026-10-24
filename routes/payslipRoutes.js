import express from "express";
import { getMyPayslips, getPayslip } from "../controllers/payrollController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyPayslips);
router.get("/:id", getPayslip);

export default router;