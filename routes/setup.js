import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Settings from "../models/Settings.js";

const router = express.Router();

router.get("/status", async (req, res) => {
  const admin = await User.exists({ role: "admin" });
  res.json({ isSetup: !!admin });
});

router.post("/", async (req, res) => {
  try {
    if (await User.exists({ role: "admin" })) {
      return res.status(409).json({ message: "Setup already completed" });
    }
    const { companyName, adminName, email, password } = req.body;
    if (!companyName || !adminName || !email || !password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "All fields are required (password min 6 characters)" });
    }
    await Settings.create({ companyName });
    const hash = await bcrypt.hash(password, 10);
    await User.create({ name: adminName, email, password: hash, role: "admin" });
    res.status(201).json({ message: "Setup complete" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;