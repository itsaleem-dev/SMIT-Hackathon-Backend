import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", allowRoles("admin"), getAuditLogs);

export default router;