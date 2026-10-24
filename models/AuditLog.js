import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true }, // create, update, delete, approve, reject, pay, generate ...
    entity: { type: String, required: true, index: true }, // users, leaves, payroll ...
    entityId: { type: String, default: "" },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    status: { type: Number, default: 200 },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;