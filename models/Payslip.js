import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    month: { type: String, required: true, index: true }, // "YYYY-MM"
    basic: { type: Number, required: true, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    absenceDeduction: { type: Number, default: 0, min: 0 },
    net: { type: Number, required: true },
    workingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    status: { type: String, enum: ["generated", "paid"], default: "generated" },
    paidAt: { type: Date },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// ek user ki ek mahine ki sirf ek payslip
payslipSchema.index({ user: 1, month: 1 }, { unique: true });

const Payslip = mongoose.model("Payslip", payslipSchema);

export default Payslip;