import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

// NOTE: Abhi backend mein Department, Attendance, Leave, Payroll, Audit ke
// models nahi hain. Jin cheezon ka data maujood hai (headcount) wo asli hai,
// baaqi khali/zero deti hain taake page crash na kare. Jaise jaise un modules
// ke models banenge, yahan asli queries laga denge.

// GET /api/dashboard/admin
export const adminDashboard = async (req, res) => {
  try {
    const headcount = await User.countDocuments({ active: true });
    const auditFeed = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select("action entity createdAt");

    return res.status(200).json({
      kpis: {
        headcount,
        attritionYtd: 0,
        payrollCost: 0,
        avgSalary: 0,
      },
      headcountByDept: [],
      payrollCostByDept: [],
      gender: [],
      tenure: [],
      auditFeed,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/dashboard/hr
export const hrDashboard = async (req, res) => {
  try {
    const headcount = await User.countDocuments({ active: true });

    return res.status(200).json({
      kpis: {
        headcount,
        present: 0,
        onLeave: 0,
        lateToday: 0,
        pendingApprovals: 0,
      },
      attendanceTrend: [],
      absenteeismByDept: [],
      leaveByType: [],
      topLateComers: [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/dashboard/employee
export const employeeDashboard = async (req, res) => {
  try {
    return res.status(200).json({
      leaveBalance: [],
      hoursThisWeek: 0,
      lateCount: 0,
      lastPayslip: null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};