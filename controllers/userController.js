import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/User.js";

const ROLES = ["admin", "hr", "employee"];

const makeTempPassword = () => crypto.randomBytes(5).toString("hex"); // 10 chars

// HR sirf employee/hr ko manage kar sakta hai, admin ko nahi
const canManage = (actor, target) => actor.role === "admin" || target.role !== "admin";

// GET /api/users?search=&role=&active=
export const getUsers = async (req, res) => {
  try {
    const filter = {};

    if (req.query.role && ROLES.includes(req.query.role)) {
      filter.role = req.query.role;
    }
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    if (req.query.search) {
      const rx = new RegExp(
        req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/users/:id  (admin/hr, ya khud apna)
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const isSelf = String(req.user._id) === id;
    if (!isSelf && !["admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/users  (admin/hr)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role = "employee" } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (role === "admin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can create an admin" });
    }
    if (password && password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const plainPassword = password || makeTempPassword();

    const user = await User.create({
      name,
      email,
      role,
      password: await bcrypt.hash(plainPassword, 12),
      mustChangePassword: true,
    });

    return res.status(201).json({
      user,
      // password na diya ho to wahi temporary password sirf ek baar wapas milta hai
      ...(password ? {} : { tempPassword: plainPassword }),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/users/:id  (admin/hr)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!canManage(req.user, user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const isSelf = String(req.user._id) === id;
    const { name, email, role, active } = req.body;

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (req.user.role !== "admin" && role === "admin") {
        return res.status(403).json({ message: "Only admin can assign admin role" });
      }
      if (isSelf && role !== user.role) {
        return res.status(400).json({ message: "You cannot change your own role" });
      }
      user.role = role;
    }

    if (active !== undefined) {
      if (isSelf && active === false) {
        return res.status(400).json({ message: "You cannot deactivate yourself" });
      }
      user.active = !!active;
    }

    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /api/users/:id  -> user ko deactivate karta hai (data delete nahi hota)
export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (String(req.user._id) === id) {
      return res.status(400).json({ message: "You cannot deactivate yourself" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!canManage(req.user, user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    user.active = false;
    await user.save();

    return res.status(200).json({ message: "User deactivated" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/users/:id/reset-password  (admin/hr)
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!canManage(req.user, user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const tempPassword = req.body.password || makeTempPassword();
    if (tempPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    user.password = await bcrypt.hash(tempPassword, 12);
    user.mustChangePassword = true;
    await user.save();

    return res
      .status(200)
      .json({ message: "Password reset", tempPassword });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};