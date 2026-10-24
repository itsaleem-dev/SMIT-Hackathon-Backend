import express from "express";
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  resetPassword,
} from "../controllers/userController.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", allowRoles("admin", "hr"), getUsers);
router.post("/", allowRoles("admin", "hr"), createUser);

router.post("/:id/reset-password", allowRoles("admin", "hr"), resetPassword);

router.get("/:id", getUser); // admin/hr ya khud apna (controller check karta hai)
router.put("/:id", allowRoles("admin", "hr"), updateUser);
router.patch("/:id", allowRoles("admin", "hr"), updateUser);
router.delete("/:id", allowRoles("admin", "hr"), deactivateUser);

export default router;