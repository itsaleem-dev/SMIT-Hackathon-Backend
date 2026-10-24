import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // "YYYY-MM-DD" (server ke local time ke hisaab se)
    date: { type: String, required: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: { type: String, enum: ["present", "late"], default: "present" },
    lateMinutes: { type: Number, default: 0 },
    halfDay: { type: Boolean, default: false },
    hours: { type: Number, default: 0 },
    checkInLocation: { lat: Number, lng: Number },
    checkOutLocation: { lat: Number, lng: Number },
  },
  { timestamps: true },
);

// ek user ka ek din mein sirf ek record
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;