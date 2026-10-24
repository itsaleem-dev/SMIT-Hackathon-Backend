import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import Settings from "../models/Settings.js";

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n) => String(n).padStart(2, "0");

// Server ke local time ke hisaab se "YYYY-MM-DD"
const toDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const round2 = (n) => Math.round(n * 100) / 100;

// do GPS points ke darmiyan meters mein faasla (haversine)
const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const getLocation = (body) => {
  const lat = Number(body?.lat ?? body?.latitude);
  const lng = Number(body?.lng ?? body?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

// Office ki geofence check. Location bheji gayi ho aur office set ho tabhi check hota hai.
const outsideOffice = (settings, loc) => {
  if (!loc || !settings?.officeLat || !settings?.officeLng) return null;
  const d = distanceMeters(loc.lat, loc.lng, settings.officeLat, settings.officeLng);
  const allowed = settings.radiusMeters ?? 150;
  return d > allowed ? Math.round(d) : null;
};

// GET /api/attendance/today  -> mera aaj ka record
export const getToday = async (req, res) => {
  try {
    const record = await Attendance.findOne({
      user: req.user._id,
      date: toDateStr(),
    });
    return res.status(200).json(record || null);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/attendance/check-in
export const checkIn = async (req, res) => {
  try {
    const date = toDateStr();

    const existing = await Attendance.findOne({ user: req.user._id, date });
    if (existing) {
      return res.status(409).json({ message: "Already checked in today" });
    }

    const settings = await Settings.findOne();
    const loc = getLocation(req.body);

    const far = outsideOffice(settings, loc);
    if (far) {
      return res.status(403).json({
        message: `You are ${far} m away from the office (allowed ${settings.radiusMeters} m)`,
      });
    }

    const now = new Date();
    const [h, m] = (settings?.officeStart || "09:00").split(":").map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);

    const grace = settings?.graceMinutes ?? 15;
    const minutesAfterStart = Math.floor((now - start) / 60000);
    const isLate = minutesAfterStart > grace;

    const record = await Attendance.create({
      user: req.user._id,
      date,
      checkIn: now,
      status: isLate ? "late" : "present",
      lateMinutes: isLate ? minutesAfterStart : 0,
      checkInLocation: loc || undefined,
    });

    return res.status(201).json(record);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Already checked in today" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/check-out
export const checkOut = async (req, res) => {
  try {
    const record = await Attendance.findOne({
      user: req.user._id,
      date: toDateStr(),
    });

    if (!record || !record.checkIn) {
      return res.status(400).json({ message: "You have not checked in today" });
    }
    if (record.checkOut) {
      return res.status(409).json({ message: "Already checked out today" });
    }

    const settings = await Settings.findOne();
    const loc = getLocation(req.body);

    const far = outsideOffice(settings, loc);
    if (far) {
      return res.status(403).json({
        message: `You are ${far} m away from the office (allowed ${settings.radiusMeters} m)`,
      });
    }

    const now = new Date();
    const hours = (now - record.checkIn) / 3600000;

    record.checkOut = now;
    record.hours = round2(hours);
    record.halfDay = hours < (settings?.halfDayHours ?? 5);
    if (loc) record.checkOutLocation = loc;
    await record.save();

    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/attendance/my?from=&to=
export const getMyAttendance = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    const { from, to } = req.query;

    if (from || to) {
      filter.date = {};
      if (from && DATE_RX.test(from)) filter.date.$gte = from;
      if (to && DATE_RX.test(to)) filter.date.$lte = to;
    }

    const records = await Attendance.find(filter).sort({ date: -1 }).limit(366);
    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/attendance?from=&to=&user=&department=   (admin/hr)
export const getAttendance = async (req, res) => {
  try {
    const filter = {};
    const { from, to, user, department } = req.query;

    if (from || to) {
      filter.date = {};
      if (from && DATE_RX.test(from)) filter.date.$gte = from;
      if (to && DATE_RX.test(to)) filter.date.$lte = to;
    }
    if (user) filter.user = user;

    if (department) {
      const ids = await Employee.find({ department }).distinct("user");
      filter.user = user ? { $in: ids.filter((i) => String(i) === user) } : { $in: ids };
    }

    const records = await Attendance.find(filter)
      .populate("user", "name email")
      .sort({ date: -1 })
      .limit(500);

    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/attendance/board?date=2026-10-24&department=   (admin/hr)
// Us din har active employee ka status: present / late / absent / weekend
export const getBoard = async (req, res) => {
  try {
    const date = DATE_RX.test(req.query.date || "") ? req.query.date : toDateStr();

    const settings = await Settings.findOne();
    const weekend = settings?.weekend ?? [0, 6];
    const isWeekend = weekend.includes(new Date(`${date}T00:00:00`).getDay());

    const empFilter = {};
    if (req.query.department) empFilter.department = req.query.department;

    const employees = await Employee.find(empFilter)
      .populate({ path: "user", select: "name email active" })
      .populate({ path: "department", select: "name" });

    const active = employees.filter((e) => e.user && e.user.active !== false);

    const records = await Attendance.find({
      date,
      user: { $in: active.map((e) => e.user._id) },
    });
    const byUser = new Map(records.map((r) => [String(r.user), r]));

    const rows = active.map((e) => {
      const r = byUser.get(String(e.user._id));
      return {
        employeeId: e.employeeId,
        userId: e.user._id,
        name: e.user.name,
        email: e.user.email,
        department: e.department?.name || "",
        status: r ? r.status : isWeekend ? "weekend" : "absent",
        checkIn: r?.checkIn || null,
        checkOut: r?.checkOut || null,
        hours: r?.hours || 0,
        lateMinutes: r?.lateMinutes || 0,
        halfDay: r?.halfDay || false,
      };
    });

    const count = (s) => rows.filter((x) => x.status === s).length;

    return res.status(200).json({
      date,
      isWeekend,
      summary: {
        total: rows.length,
        present: count("present"),
        late: count("late"),
        absent: count("absent"),
      },
      rows,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};