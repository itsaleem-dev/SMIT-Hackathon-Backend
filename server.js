import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import setupRoutes from "./routes/setup.js";
import authRoutes from "./routes/authRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import leaveTypeRoutes from "./routes/leaveTypeRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import payslipRoutes from "./routes/payslipRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import auditLogger from "./middleware/auditLogger.js";

dotenv.config();

const app = express();

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: (origin, callback) =>
      !origin || origin === allowedOrigin
        ? callback(null, true)
        : callback(new Error("Not allowed by CORS")),
    credentials: true,
  }),
);

app.use(express.json());
app.use(auditLogger);

app.use("/api/setup", setupRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Backend API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();