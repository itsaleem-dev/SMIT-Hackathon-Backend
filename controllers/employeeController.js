import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import User from "../models/User.js";

const POPULATE = [
  { path: "user", select: "name email role active mustChangePassword" },
  { path: "department", select: "name" },
];

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const makeTempPassword = () => crypto.randomBytes(5).toString("hex");

const nextEmployeeId = async () => {
  const last = await Employee.findOne().sort({ createdAt: -1 });
  const n = last?.employeeId ? parseInt(last.employeeId.split("-")[1], 10) || 0 : 0;
  return `EMP-${String(n + 1).padStart(4, "0")}`;
};

const PROFILE_FIELDS = [
  "department",
  "designation",
  "gender",
  "phone",
  "address",
  "joinDate",
  "salary",
];

// GET /api/employees?page=1&limit=10&search=&department=&active=
export const getEmployees = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = {};

    if (req.query.department && mongoose.isValidObjectId(req.query.department)) {
      filter.department = req.query.department;
    }

    // name/email/active User model mein hain, isliye pehle user ids nikalte hain
    const userFilter = {};
    if (req.query.active === "true") userFilter.active = true;
    if (req.query.active === "false") userFilter.active = false;

    if (req.query.search) {
      const rx = new RegExp(escapeRx(req.query.search.trim()), "i");
      userFilter.$or = [{ name: rx }, { email: rx }];
    }

    if (Object.keys(userFilter).length) {
      const ids = await User.find(userFilter).distinct("_id");
      if (req.query.search) {
        const rx = new RegExp(escapeRx(req.query.search.trim()), "i");
        filter.$or = [{ user: { $in: ids } }, { employeeId: rx }];
      } else {
        filter.user = { $in: ids };
      }
    }

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate(POPULATE)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Employee.countDocuments(filter),
    ]);

    return res.status(200).json({
      employees,
      total,
      page,
      limit,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/employees/me
export const getMyEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id }).populate(POPULATE);
    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }
    return res.status(200).json(employee);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/employees/:id  (admin/hr, ya khud apna)
export const getEmployee = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid employee id" });
    }

    const employee = await Employee.findById(req.params.id).populate(POPULATE);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const isSelf = String(employee.user?._id) === String(req.user._id);
    if (!isSelf && !["admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(employee);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/employees  -> User account + Employee profile dono banata hai
export const createEmployee = async (req, res) => {
  let user;
  try {
    const { name, email, password, role = "employee" } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    if (!["admin", "hr", "employee"].includes(role)) {
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

    user = await User.create({
      name,
      email,
      role,
      password: await bcrypt.hash(plainPassword, 12),
      mustChangePassword: true,
    });

    const profile = {};
    for (const key of PROFILE_FIELDS) {
      if (req.body[key] !== undefined && req.body[key] !== "") {
        profile[key] = req.body[key];
      }
    }

    const employee = await Employee.create({
      ...profile,
      user: user._id,
      employeeId: await nextEmployeeId(),
    });

    await employee.populate(POPULATE);

    return res.status(201).json({
      employee,
      ...(password ? {} : { tempPassword: plainPassword }),
    });
  } catch (error) {
    // employee na ban saka to adhoora user wapas hata do
    if (user) await User.findByIdAndDelete(user._id).catch(() => {});

    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/employees/:id
export const updateEmployee = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid employee id" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const user = await User.findById(employee.user);
    if (user && user.role === "admin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    for (const key of PROFILE_FIELDS) {
      if (req.body[key] !== undefined) {
        employee[key] = req.body[key] === "" && key === "department" ? null : req.body[key];
      }
    }

    if (user) {
      const isSelf = String(user._id) === String(req.user._id);
      if (req.body.name !== undefined) user.name = req.body.name;
      if (req.body.email !== undefined) user.email = req.body.email;
      if (req.body.active !== undefined) {
        if (isSelf && req.body.active === false) {
          return res.status(400).json({ message: "You cannot deactivate yourself" });
        }
        user.active = !!req.body.active;
      }
      await user.save();
    }

    await employee.save();
    await employee.populate(POPULATE);

    return res.status(200).json(employee);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /api/employees/:id  -> account deactivate hota hai, record bacha rehta hai
export const deactivateEmployee = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid employee id" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (String(employee.user) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot deactivate yourself" });
    }

    const user = await User.findById(employee.user);
    if (user && user.role === "admin" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (user) {
      user.active = false;
      await user.save();
    }

    return res.status(200).json({ message: "Employee deactivated" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};