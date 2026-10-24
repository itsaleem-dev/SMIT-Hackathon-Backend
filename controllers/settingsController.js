import Settings from "../models/Settings.js";

const EDITABLE = [
  "companyName",
  "officeStart",
  "graceMinutes",
  "halfDayHours",
  "weekend",
  "officeLat",
  "officeLng",
  "radiusMeters",
];

// GET /api/settings  (har logged-in user, kyunke check-in ko office location chahiye)
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      return res.status(404).json({ message: "Settings not found. Run setup first." });
    }

    return res.status(200).json(settings);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/settings  (sirf admin)
export const updateSettings = async (req, res) => {
  try {
    const updates = {};
    for (const key of EDITABLE) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.companyName !== undefined && !String(updates.companyName).trim()) {
      return res.status(400).json({ message: "Company name cannot be empty" });
    }

    const settings = await Settings.findOneAndUpdate({}, updates, {
      new: true,
      runValidators: true,
    });

    if (!settings) {
      return res.status(404).json({ message: "Settings not found. Run setup first." });
    }

    return res.status(200).json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};