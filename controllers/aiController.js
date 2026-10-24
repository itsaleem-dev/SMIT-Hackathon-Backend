import Attendance from "../models/Attendance.js";
import AttendanceCorrection from "../models/AttendanceCorrection.js";
import Leave from "../models/Leave.js";
import Payslip from "../models/Payslip.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { computeBalance } from "./leaveController.js";
import { askClaude, AiError } from "../services/anthropic.js";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ---- chhota in-memory rate limit: har user ke liye 20 requests / minute ----
const hits = new Map();
const limited = (userId) => {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 20;
};

// Sirf us user ka apna data (aur admin/hr ke liye company-level ginti) AI ko diya jata hai.
const buildContext = async (user) => {
  const settings = await Settings.findOne();
  const today = todayStr();
  const month = today.slice(0, 7);

  const [balance, todayRecord, lastPayslip, myPending, monthAttendance] = await Promise.all([
    computeBalance(user._id),
    Attendance.findOne({ user: user._id, date: today }),
    Payslip.findOne({ user: user._id }).sort({ month: -1 }),
    Leave.countDocuments({ user: user._id, status: "pending" }),
    Attendance.find({ user: user._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } }),
  ]);

  const lines = [
    `Today: ${today}`,
    `Company: ${settings?.companyName || "N/A"}`,
    `Office start: ${settings?.officeStart || "09:00"}, grace: ${settings?.graceMinutes ?? 15} min, half-day if under ${settings?.halfDayHours ?? 5} hours`,
    `Weekend days (0=Sun): ${(settings?.weekend ?? [0, 6]).join(", ")}`,
    "",
    `Logged-in user: ${user.name} (role: ${user.role})`,
    `Leave balance this year: ${
      balance.length
        ? balance.map((b) => `${b.type} ${b.remaining} left of ${b.allowed} (used ${b.used}, pending ${b.pending})`).join("; ")
        : "no leave types configured"
    }`,
    `Pending leave requests of this user: ${myPending}`,
    `Today's attendance: ${
      todayRecord
        ? `checked in ${todayRecord.checkIn?.toISOString() || "-"}, ${todayRecord.status}${
            todayRecord.checkOut ? `, checked out, ${todayRecord.hours} h` : ", not checked out yet"
          }`
        : "not checked in"
    }`,
    `This month: ${monthAttendance.length} days present, ${monthAttendance.filter((a) => a.status === "late").length} late`,
    `Last payslip: ${lastPayslip ? `${lastPayslip.month}, net ${lastPayslip.net}, ${lastPayslip.status}` : "none yet"}`,
  ];

  if (["admin", "hr"].includes(user.role)) {
    const [headcount, presentToday, lateToday, pendingLeaves, pendingCorrections] = await Promise.all([
      User.countDocuments({ active: true }),
      Attendance.countDocuments({ date: today }),
      Attendance.countDocuments({ date: today, status: "late" }),
      Leave.countDocuments({ status: "pending" }),
      AttendanceCorrection.countDocuments({ status: "pending" }),
    ]);
    lines.push(
      "",
      "Company-wide (visible because user is admin/hr):",
      `Active users: ${headcount}, checked in today: ${presentToday}, late today: ${lateToday}`,
      `Pending leave requests: ${pendingLeaves}, pending attendance corrections: ${pendingCorrections}`,
    );
  }

  return lines.join("\n");
};

const cleanHistory = (history) => {
  if (!Array.isArray(history)) return [];
  const msgs = history
    .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-10);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
};

const sendError = (res, error) => {
  if (error instanceof AiError) {
    return res.status(error.status).json({ message: error.message });
  }
  return res.status(500).json({ message: "Server error" });
};

// POST /api/ai/chat  { message, history?: [{role, content}] }
export const chat = async (req, res) => {
  try {
    const message = String(req.body?.message ?? req.body?.prompt ?? "").trim();
    if (!message) return res.status(400).json({ message: "Message is required" });
    if (message.length > 2000) {
      return res.status(400).json({ message: "Message is too long (max 2000 characters)" });
    }
    if (limited(String(req.user._id))) {
      return res.status(429).json({ message: "Too many AI requests. Please wait a minute." });
    }

    const context = await buildContext(req.user);

    const system = [
      "You are the HR assistant inside an HR management app. Be friendly, short and practical.",
      "Answer ONLY from the data below and general HR knowledge. If the data does not contain the answer, say you don't have that information and point to the right page or person (HR).",
      "Never invent numbers, dates or policies. Never reveal other employees' personal data. Do not give legal or medical advice.",
      "Reply in the same language the user writes in (English, Urdu or Roman Urdu).",
      "",
      "DATA:",
      context,
    ].join("\n");

    const messages = [...cleanHistory(req.body?.history), { role: "user", content: message }];

    const reply = await askClaude({ system, messages, maxTokens: 700 });

    return res.status(200).json({ reply, message: reply });
  } catch (error) {
    return sendError(res, error);
  }
};

// "- point" / "1. point" wagera saaf kar ke bullets ki list banata hai
const toBullets = (text) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed) ? parsed : parsed?.bullets;
    if (Array.isArray(arr)) return arr.map(String).filter(Boolean).slice(0, 6);
  } catch {
    // JSON nahi tha, lines mein todte hain
  }
  return cleaned
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
};

// POST /api/ai/summary  { filters, kpis }   (admin/hr)
export const summary = async (req, res) => {
  try {
    if (limited(String(req.user._id))) {
      return res.status(429).json({ message: "Too many AI requests. Please wait a minute." });
    }

    const { filters = {}, kpis = {} } = req.body || {};
    const payload = JSON.stringify({ filters, dashboard: kpis }).slice(0, 8000);

    const system = [
      "You analyse HR dashboard data and write short insights for a manager.",
      "Use ONLY the JSON given. Never invent numbers. If most values are zero or empty, say that data is limited instead of drawing conclusions.",
      'Return ONLY a JSON array of 3 to 5 short strings (each under 25 words), with no other text. Example: ["Point one", "Point two"]',
    ].join("\n");

    const text = await askClaude({
      system,
      messages: [{ role: "user", content: `Dashboard data:\n${payload}` }],
      maxTokens: 500,
    });

    const bullets = toBullets(text);
    return res.status(200).json({ bullets, summary: bullets });
  } catch (error) {
    return sendError(res, error);
  }
};