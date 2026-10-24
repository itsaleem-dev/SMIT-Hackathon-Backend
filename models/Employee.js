import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeId: { type: String, unique: true, index: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    designation: { type: String, default: "", trim: true },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    joinDate: { type: Date, default: Date.now },
    salary: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;