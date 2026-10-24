import express from "express";
import {
  login,
  getProfile,
  changePassword,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authMiddleware, getProfile);
router.post("/change-password", authMiddleware, changePassword);

export default router;