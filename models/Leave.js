import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },
    from: { type: String, required: true }, // "YYYY-MM-DD"
    to: { type: String, required: true }, // "YYYY-MM-DD"
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

const Leave = mongoose.model("Leave", leaveSchema);

export default Leave;