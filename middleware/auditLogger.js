import AuditLog from "../models/AuditLog.js";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const VERB = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

// In entities ke badlaav log nahi hote (shor ya khud audit)
const SKIP_ENTITIES = new Set(["audit", "notifications", "ai", "auth", "setup"]);

// Har kamyab badlaav (POST/PUT/PATCH/DELETE) ko khud record karta hai.
// Request body kabhi save nahi hoti, is liye passwords wagera log mein nahi aate.
const auditLogger = (req, res, next) => {
  if (!VERB[req.method]) return next();

  res.on("finish", () => {
    try {
      if (res.statusCode >= 400 || !req.user) return;

      const segments = req.originalUrl.split("?")[0].split("/").filter(Boolean); // ["api","leaves","<id>","approve"]
      if (segments[0] !== "api") return;

      const entity = segments[1];
      if (!entity || SKIP_ENTITIES.has(entity)) return;

      const rest = segments.slice(2);
      const entityId = rest.find((s) => OBJECT_ID.test(s)) || "";
      const words = rest.filter((s) => !OBJECT_ID.test(s));
      const action = words.length ? words.join(" ") : VERB[req.method];

      AuditLog.create({
        user: req.user._id,
        action,
        entity,
        entityId,
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        ip: req.ip || "",
      }).catch(() => {});
    } catch {
      // audit ki wajah se request kabhi fail nahi honi chahiye
    }
  });

  next();
};

export default auditLogger;