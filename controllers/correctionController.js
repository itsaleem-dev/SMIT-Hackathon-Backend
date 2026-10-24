import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import AttendanceCorrection from "../models/AttendanceCorrection.js";
import Settings from "../models/Settings.js";
import Notification from "../models/Notification.js";

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RX = /^\d{1,2}:\d{2}$/;
const STATUSES = ["pending", "approved", "rejected"];

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "09:30" (us date par) ya poora ISO datetime dono chalte hain
const parseTime = (value, date) => {
  if (!value) return null;
  if (TIME_RX.test(String(value))) {
    const [h, m] = String(value).split(":").map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const POPULATE = [
  { path: "user", select: "name email" },
  { path: "reviewedBy", select: "name" },
];

// GET /api/attendance/corrections?status=pending
// admin/hr ko sab nazar aati hain, employee ko sirf apni
export const getCorrections = async (req, res) => {
  try {
    const filter = {};
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (!["admin", "hr"].includes(req.user.role)) filter.user = req.user._id;

    const corrections = await AttendanceCorrection.find(filter)
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json(corrections);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/attendance/corrections
export const createCorrection = async (req, res) => {
  try {
    const { date, checkIn, checkOut, reason } = req.body;

    if (!date || !DATE_RX.test(date)) {
      return res.status(400).json({ message: "A valid date (YYYY-MM-DD) is required" });
    }
    if (date > todayStr()) {
      return res.status(400).json({ message: "Date cannot be in the future" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const inTime = parseTime(checkIn, date);
    const outTime = parseTime(checkOut, date);

    if (inTime === undefined || outTime === undefined) {
      return res.status(400).json({ message: "Invalid time format" });
    }
    if (!inTime && !outTime) {
      return res.status(400).json({ message: "Provide check-in and/or check-out time" });
    }
    if (inTime && outTime && outTime <= inTime) {
      return res.status(400).json({ message: "Check-out must be after check-in" });
    }

    const duplicate = await AttendanceCorrection.exists({
      user: req.user._id,
      date,
      status: "pending",
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ message: "A pending correction already exists for this date" });
    }

    const correction = await AttendanceCorrection.create({
      user: req.user._id,
      date,
      checkIn: inTime || undefined,
      checkOut: outTime || undefined,
      reason,
    });

    return res.status(201).json(correction);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Approve hone par attendance record banata/update karta hai aur late/hours dobara nikalta hai
const applyToAttendance = async (correction) => {
  const settings = await Settings.findOne();

  let record = await Attendance.findOne({
    user: correction.user,
    date: correction.date,
  });
  if (!record) {
    record = new Attendance({ user: correction.user, date: correction.date });
  }

  if (correction.checkIn) record.checkIn = correction.checkIn;
  if (correction.checkOut) record.checkOut = correction.checkOut;

  if (record.checkIn) {
    const [h, m] = (settings?.officeStart || "09:00").split(":").map(Number);
    const start = new Date(record.checkIn);
    start.setHours(h, m, 0, 0);
    const grace = settings?.graceMinutes ?? 15;
    const minutesAfter = Math.floor((record.checkIn - start) / 60000);
    const late = minutesAfter > grace;
    record.status = late ? "late" : "present";
    record.lateMinutes = late ? minutesAfter : 0;
  }

  if (record.checkIn && record.checkOut) {
    const hours = (record.checkOut - record.checkIn) / 3600000;
    record.hours = Math.round(hours * 100) / 100;
    record.halfDay = hours < (settings?.halfDayHours ?? 5);
  }

  await record.save();
  return record;
};

const review = (decision) => async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid correction id" });
    }

    const correction = await AttendanceCorrection.findById(req.params.id);
    if (!correction) {
      return res.status(404).json({ message: "Correction not found" });
    }
    if (correction.status !== "pending") {
      return res.status(409).json({ message: `Already ${correction.status}` });
    }
    if (String(correction.user) === String(req.user._id)) {
      return res
        .status(403)
        .json({ message: "You cannot review your own correction" });
    }

    if (decision === "approved") await applyToAttendance(correction);

    correction.status = decision;
    correction.reviewedBy = req.user._id;
    correction.reviewedAt = new Date();
    correction.reviewNote = req.body?.note || req.body?.reviewNote || "";
    await correction.save();

    await Notification.create({
      user: correction.user,
      title: `Attendance correction ${decision}`,
      message: `Your correction for ${correction.date} was ${decision}.${
        correction.reviewNote ? " Note: " + correction.reviewNote : ""
      }`,
      type: "attendance",
    }).catch(() => {});

    await correction.populate(POPULATE);
    return res.status(200).json(correction);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const approveCorrection = review("approved");
export const rejectCorrection = review("rejected");

// PATCH/PUT /api/attendance/corrections/:id  { status: "approved" | "rejected", note }
export const decideCorrection = (req, res) => {
  if (req.body?.status === "approved") return approveCorrection(req, res);
  if (req.body?.status === "rejected") return rejectCorrection(req, res);
  return res
    .status(400)
    .json({ message: 'status must be "approved" or "rejected"' });
};