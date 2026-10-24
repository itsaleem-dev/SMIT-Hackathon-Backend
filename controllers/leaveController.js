import mongoose from "mongoose";
import Leave from "../models/Leave.js";
import LeaveType from "../models/LeaveType.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["pending", "approved", "rejected", "cancelled"];

const DEFAULT_TYPES = [
  { name: "Annual", daysPerYear: 14 },
  { name: "Sick", daysPerYear: 10 },
  { name: "Casual", daysPerYear: 7 },
];

const POPULATE = [
  { path: "user", select: "name email" },
  { path: "leaveType", select: "name daysPerYear" },
  { path: "reviewedBy", select: "name" },
];

// Koi leave type na ho to pehli dafa default types bana deta hai (baad mein edit ho sakte hain)
const ensureTypes = async () => {
  if ((await LeaveType.countDocuments()) === 0) {
    await LeaveType.insertMany(DEFAULT_TYPES).catch(() => {});
  }
};

const dateOf = (s) => new Date(`${s}T00:00:00`);

// from se to tak (dono shamil) kaam ke din, weekend nikal kar
const countDays = (from, to, weekend) => {
  let days = 0;
  for (let d = dateOf(from); d <= dateOf(to); d.setDate(d.getDate() + 1)) {
    if (!weekend.includes(d.getDay())) days += 1;
  }
  return days;
};

// Ek user ka us saal ka balance, har leave type ke hisaab se
export const computeBalance = async (userId, year = new Date().getFullYear()) => {
  await ensureTypes();
  const types = await LeaveType.find({ active: true }).sort({ name: 1 });
  const leaves = await Leave.find({
    user: userId,
    status: { $in: ["approved", "pending"] },
    from: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
  });

  return types.map((t) => {
    const mine = leaves.filter((l) => String(l.leaveType) === String(t._id));
    const used = mine.filter((l) => l.status === "approved").reduce((s, l) => s + l.days, 0);
    const pending = mine.filter((l) => l.status === "pending").reduce((s, l) => s + l.days, 0);
    return {
      leaveType: t._id,
      type: t.name,
      allowed: t.daysPerYear,
      used,
      pending,
      remaining: t.daysPerYear - used - pending,
    };
  });
};

// ---------- Leave types ----------

// GET /api/leave-types
export const getLeaveTypes = async (req, res) => {
  try {
    await ensureTypes();
    const filter = req.query.all === "true" ? {} : { active: true };
    const types = await LeaveType.find(filter).sort({ name: 1 });
    return res.status(200).json(types);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/leave-types  (admin/hr)
export const createLeaveType = async (req, res) => {
  try {
    const { name, daysPerYear } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const type = await LeaveType.create({ name, daysPerYear: Number(daysPerYear) || 0 });
    return res.status(201).json(type);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Leave type already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/leave-types/:id  (admin/hr)
export const updateLeaveType = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const updates = {};
    for (const key of ["name", "daysPerYear", "active"]) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const type = await LeaveType.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!type) return res.status(404).json({ message: "Leave type not found" });
    return res.status(200).json(type);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Leave type already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /api/leave-types/:id  (admin/hr) -> purani leaves bachi rehti hain, type inactive ho jati hai
export const deleteLeaveType = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const type = await LeaveType.findByIdAndUpdate(req.params.id, { active: false });
    if (!type) return res.status(404).json({ message: "Leave type not found" });
    return res.status(200).json({ message: "Leave type deactivated" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------- Leaves ----------

// GET /api/leaves?status=pending&user=   (admin/hr sab dekhte hain, employee sirf apni)
export const getLeaves = async (req, res) => {
  try {
    const filter = {};
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

    if (["admin", "hr"].includes(req.user.role)) {
      if (req.query.user && mongoose.isValidObjectId(req.query.user)) {
        filter.user = req.query.user;
      }
    } else {
      filter.user = req.user._id;
    }

    const leaves = await Leave.find(filter)
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .limit(300);

    return res.status(200).json(leaves);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/leaves/my
export const getMyLeaves = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const leaves = await Leave.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    return res.status(200).json(leaves);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/leaves/balance
export const getMyBalance = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    return res.status(200).json(await computeBalance(req.user._id, year));
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/leaves   { leaveType (id ya naam), from, to, reason }
export const applyLeave = async (req, res) => {
  try {
    const { from, to, reason } = req.body;
    const typeInput = req.body.leaveType ?? req.body.type;

    if (!from || !to || !DATE_RX.test(from) || !DATE_RX.test(to)) {
      return res.status(400).json({ message: "Valid from and to dates (YYYY-MM-DD) are required" });
    }
    if (to < from) {
      return res.status(400).json({ message: "End date cannot be before start date" });
    }
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      return res.status(400).json({ message: "Leave cannot span two calendar years. Apply separately." });
    }

    await ensureTypes();
    let type = null;
    if (typeInput && mongoose.isValidObjectId(typeInput)) {
      type = await LeaveType.findById(typeInput);
    } else if (typeInput) {
      type = await LeaveType.findOne({ name: new RegExp(`^${String(typeInput).trim()}$`, "i") });
    }
    if (!type || !type.active) {
      return res.status(400).json({ message: "Valid leave type is required" });
    }

    const settings = await Settings.findOne();
    const days = countDays(from, to, settings?.weekend ?? [0, 6]);
    if (days === 0) {
      return res.status(400).json({ message: "Selected dates fall only on weekends" });
    }

    const overlap = await Leave.exists({
      user: req.user._id,
      status: { $in: ["pending", "approved"] },
      from: { $lte: to },
      to: { $gte: from },
    });
    if (overlap) {
      return res.status(409).json({ message: "You already have a leave in these dates" });
    }

    const balance = (await computeBalance(req.user._id, Number(from.slice(0, 4)))).find(
      (b) => String(b.leaveType) === String(type._id),
    );
    if (balance && days > balance.remaining) {
      return res.status(400).json({
        message: `Not enough ${type.name} leave balance (remaining ${balance.remaining}, requested ${days})`,
      });
    }

    const leave = await Leave.create({
      user: req.user._id,
      leaveType: type._id,
      from,
      to,
      days,
      reason,
    });

    // admin/hr ko batao
    const reviewers = await User.find({
      role: { $in: ["admin", "hr"] },
      active: true,
      _id: { $ne: req.user._id },
    }).select("_id");
    if (reviewers.length) {
      await Notification.insertMany(
        reviewers.map((r) => ({
          user: r._id,
          title: "New leave request",
          message: `${req.user.name} requested ${days} day(s) of ${type.name} leave (${from} to ${to}).`,
          type: "leave",
          link: "/leaves",
        })),
      ).catch(() => {});
    }

    await leave.populate(POPULATE);
    return res.status(201).json(leave);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const review = (decision) => async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid leave id" });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    if (leave.status !== "pending") {
      return res.status(409).json({ message: `Already ${leave.status}` });
    }

    // admin ke ilawa koi apni leave khud approve nahi kar sakta
    if (String(leave.user) === String(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You cannot review your own leave" });
    }

    leave.status = decision;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.reviewNote = req.body?.note || req.body?.reviewNote || "";
    await leave.save();

    await Notification.create({
      user: leave.user,
      title: `Leave ${decision}`,
      message: `Your leave (${leave.from} to ${leave.to}) was ${decision}.${
        leave.reviewNote ? " Note: " + leave.reviewNote : ""
      }`,
      type: "leave",
      link: "/leaves",
    }).catch(() => {});

    await leave.populate(POPULATE);
    return res.status(200).json(leave);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const approveLeave = review("approved");
export const rejectLeave = review("rejected");

// PATCH/PUT /api/leaves/:id  { status: "approved" | "rejected" | "cancelled", note }
export const decideLeave = (req, res) => {
  if (req.body?.status === "approved") return approveLeave(req, res);
  if (req.body?.status === "rejected") return rejectLeave(req, res);
  if (req.body?.status === "cancelled") return cancelLeave(req, res);
  return res
    .status(400)
    .json({ message: 'status must be "approved", "rejected" or "cancelled"' });
};

// PATCH/DELETE /api/leaves/:id/cancel  (apni pending leave)
export const cancelLeave = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid leave id" });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    if (String(leave.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (leave.status !== "pending") {
      return res.status(409).json({ message: "Only pending leaves can be cancelled" });
    }

    leave.status = "cancelled";
    await leave.save();

    await leave.populate(POPULATE);
    return res.status(200).json(leave);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};