import mongoose from "mongoose";

const correctionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    checkIn: { type: Date },
    checkOut: { type: Date },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

const AttendanceCorrection = mongoose.model(
  "AttendanceCorrection",
  correctionSchema,
);

export default AttendanceCorrection;