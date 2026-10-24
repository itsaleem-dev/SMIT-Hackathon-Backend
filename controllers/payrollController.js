import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import Notification from "../models/Notification.js";
import Payslip from "../models/Payslip.js";
import Settings from "../models/Settings.js";

const MONTH_RX = /^\d{4}-(0[1-9]|1[0-2])$/;
const POPULATE = [
  { path: "user", select: "name email" },
  { path: "employee", select: "employeeId designation department" },
];

const pad = (n) => String(n).padStart(2, "0");
const round2 = (n) => Math.round(n * 100) / 100;
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const calcNet = (p) =>
  round2(Math.max(0, p.basic + p.allowances + p.bonus - p.deductions - p.absenceDeduction));

// Mahine ke saare kaam ke din (weekend ke baghair) "YYYY-MM-DD" ki list
const workingDatesOf = (month, weekend) => {
  const [y, m] = month.split("-").map(Number);
  const dates = [];
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    if (!weekend.includes(new Date(y, m - 1, d).getDay())) {
      dates.push(`${y}-${pad(m)}-${pad(d)}`);
    }
  }
  return dates;
};

// POST /api/payroll/generate  { month: "2026-10", deductAbsences: false, overwrite: false }
export const generatePayroll = async (req, res) => {
  try {
    const month = req.body.month || currentMonth();
    if (!MONTH_RX.test(month)) {
      return res.status(400).json({ message: "month must be in YYYY-MM format" });
    }

    const deductAbsences = req.body.deductAbsences === true;
    const settings = await Settings.findOne();
    const weekend = settings?.weekend ?? [0, 6];
    const workDates = workingDatesOf(month, weekend);
    const workSet = new Set(workDates);

    const employees = await Employee.find({ salary: { $gt: 0 } }).populate({
      path: "user",
      select: "name active",
    });
    const active = employees.filter((e) => e.user && e.user.active !== false);

    let created = 0;
    let skipped = 0;
    const createdFor = [];

    for (const emp of active) {
      const existing = await Payslip.findOne({ user: emp.user._id, month });
      if (existing && (existing.status === "paid" || req.body.overwrite !== true)) {
        skipped += 1;
        continue;
      }

      const [attendance, leaves] = await Promise.all([
        Attendance.find({
          user: emp.user._id,
          date: { $gte: `${month}-01`, $lte: `${month}-31` },
        }).select("date"),
        Leave.find({
          user: emp.user._id,
          status: "approved",
          from: { $lte: `${month}-31` },
          to: { $gte: `${month}-01` },
        }).select("from to"),
      ]);

      const presentSet = new Set(attendance.map((a) => a.date).filter((d) => workSet.has(d)));

      const leaveSet = new Set();
      for (const l of leaves) {
        for (let d = new Date(`${l.from}T00:00:00`); d <= new Date(`${l.to}T00:00:00`); d.setDate(d.getDate() + 1)) {
          const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          if (workSet.has(ds) && !presentSet.has(ds)) leaveSet.add(ds);
        }
      }

      const workingDays = workDates.length;
      const presentDays = presentSet.size;
      const leaveDays = leaveSet.size;
      const absentDays = Math.max(workingDays - presentDays - leaveDays, 0);

      const absenceDeduction =
        deductAbsences && workingDays > 0
          ? round2((emp.salary / workingDays) * absentDays)
          : 0;

      const data = {
        user: emp.user._id,
        employee: emp._id,
        month,
        basic: emp.salary,
        allowances: 0,
        bonus: 0,
        deductions: 0,
        absenceDeduction,
        workingDays,
        presentDays,
        leaveDays,
        absentDays,
        generatedBy: req.user._id,
      };
      data.net = calcNet(data);

      if (existing) {
        // overwrite: pehle diye gaye manual allowances/bonus/deductions barqarar rakho
        data.allowances = existing.allowances;
        data.bonus = existing.bonus;
        data.deductions = existing.deductions;
        data.net = calcNet(data);
        await Payslip.updateOne({ _id: existing._id }, data);
      } else {
        await Payslip.create(data);
        createdFor.push(emp.user._id);
      }
      created += 1;
    }

    if (createdFor.length) {
      await Notification.insertMany(
        createdFor.map((id) => ({
          user: id,
          title: "Payslip available",
          message: `Your payslip for ${month} is ready.`,
          type: "payroll",
          link: "/payslips",
        })),
      ).catch(() => {});
    }

    return res.status(200).json({
      message: `Payroll generated for ${month}`,
      month,
      generated: created,
      skipped,
      deductAbsences,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/payroll?month=2026-10&status=paid
export const getPayroll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.month && MONTH_RX.test(req.query.month)) filter.month = req.query.month;
    if (["generated", "paid"].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.user && mongoose.isValidObjectId(req.query.user)) filter.user = req.query.user;

    const payslips = await Payslip.find(filter)
      .populate(POPULATE)
      .sort({ month: -1, createdAt: -1 })
      .limit(500);

    return res.status(200).json(payslips);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/payroll/summary?month=2026-10
export const getSummary = async (req, res) => {
  try {
    const month = MONTH_RX.test(req.query.month || "") ? req.query.month : currentMonth();
    const [row] = await Payslip.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalNet: { $sum: "$net" },
          totalBasic: { $sum: "$basic" },
          paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        },
      },
    ]);

    const count = row?.count || 0;
    return res.status(200).json({
      month,
      count,
      paid: row?.paid || 0,
      pending: count - (row?.paid || 0),
      totalNet: round2(row?.totalNet || 0),
      totalBasic: round2(row?.totalBasic || 0),
      averageNet: count ? round2((row?.totalNet || 0) / count) : 0,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/payroll/:id  { allowances, bonus, deductions }  (paid se pehle)
export const updatePayslip = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payslip id" });
    }

    const payslip = await Payslip.findById(req.params.id);
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });
    if (payslip.status === "paid") {
      return res.status(409).json({ message: "Paid payslip cannot be edited" });
    }

    for (const key of ["allowances", "bonus", "deductions"]) {
      if (req.body[key] !== undefined) {
        const v = Number(req.body[key]);
        if (!Number.isFinite(v) || v < 0) {
          return res.status(400).json({ message: `${key} must be a non-negative number` });
        }
        payslip[key] = v;
      }
    }
    payslip.net = calcNet(payslip);
    await payslip.save();
    await payslip.populate(POPULATE);

    return res.status(200).json(payslip);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST/PATCH /api/payroll/:id/pay
export const payPayslip = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payslip id" });
    }

    const payslip = await Payslip.findById(req.params.id);
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });
    if (payslip.status === "paid") {
      return res.status(409).json({ message: "Already paid" });
    }

    payslip.status = "paid";
    payslip.paidAt = new Date();
    await payslip.save();
    await payslip.populate(POPULATE);

    return res.status(200).json(payslip);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/payroll/pay  { month }  -> us mahine ki sab payslips paid
export const payMonth = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month || !MONTH_RX.test(month)) {
      return res.status(400).json({ message: "month must be in YYYY-MM format" });
    }
    const result = await Payslip.updateMany(
      { month, status: "generated" },
      { status: "paid", paidAt: new Date() },
    );
    return res.status(200).json({ message: "Marked as paid", modified: result.modifiedCount });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/payroll/:id  (paid se pehle)
export const deletePayslip = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payslip id" });
    }
    const payslip = await Payslip.findById(req.params.id);
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });
    if (payslip.status === "paid") {
      return res.status(409).json({ message: "Paid payslip cannot be deleted" });
    }
    await payslip.deleteOne();
    return res.status(200).json({ message: "Payslip deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ---------- Employee ki apni payslips ----------

// GET /api/payslips
export const getMyPayslips = async (req, res) => {
  try {
    const payslips = await Payslip.find({ user: req.user._id })
      .populate(POPULATE)
      .sort({ month: -1 });
    return res.status(200).json(payslips);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/payslips/:id  (apni, ya admin/hr koi bhi)
export const getPayslip = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payslip id" });
    }
    const payslip = await Payslip.findById(req.params.id).populate(POPULATE);
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });

    const isOwner = String(payslip.user?._id) === String(req.user._id);
    if (!isOwner && !["admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return res.status(200).json(payslip);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};