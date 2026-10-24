import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    daysPerYear: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const LeaveType = mongoose.model("LeaveType", leaveTypeSchema);

export default LeaveType;