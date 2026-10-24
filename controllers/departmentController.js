import mongoose from "mongoose";
import Department from "../models/Department.js";

// GET /api/departments
export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate("head", "name email")
      .sort({ name: 1 });

    return res.status(200).json(departments);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/departments/:id
export const getDepartment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid department id" });
    }

    const department = await Department.findById(req.params.id).populate(
      "head",
      "name email",
    );

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    return res.status(200).json(department);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/departments
export const createDepartment = async (req, res) => {
  try {
    const { name, description, head } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Department name is required" });
    }

    const department = await Department.create({
      name,
      description,
      head: head || null,
    });

    return res.status(201).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Department already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/departments/:id
export const updateDepartment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid department id" });
    }

    const updates = {};
    for (const key of ["name", "description", "head", "active"]) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.head === "") updates.head = null;

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    return res.status(200).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Department already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /api/departments/:id
export const deleteDepartment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid department id" });
    }

    const department = await Department.findByIdAndDelete(req.params.id);

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    return res.status(200).json({ message: "Department deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};