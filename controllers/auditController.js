import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/audit?page=1&limit=20&entity=&action=&user=&from=&to=   (sirf admin)
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {};
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.action) filter.action = new RegExp(req.query.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (req.query.user && mongoose.isValidObjectId(req.query.user)) filter.user = req.query.user;

    const { from, to } = req.query;
    if ((from && DATE_RX.test(from)) || (to && DATE_RX.test(to))) {
      filter.createdAt = {};
      if (from && DATE_RX.test(from)) filter.createdAt.$gte = new Date(`${from}T00:00:00`);
      if (to && DATE_RX.test(to)) filter.createdAt.$lte = new Date(`${to}T23:59:59.999`);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      logs,
      data: logs, // alias, taake frontend jis naam se bhi padhe chal jaye
      total,
      page,
      limit,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};