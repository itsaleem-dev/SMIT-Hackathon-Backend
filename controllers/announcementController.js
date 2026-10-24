import mongoose from "mongoose";
import Announcement from "../models/Announcement.js";

// GET /api/announcements?limit=3
export const getAnnouncements = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const announcements = await Announcement.find()
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json(announcements);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/announcements  (admin/hr)
export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, message } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const announcement = await Announcement.create({
      title,
      body: body ?? message ?? "",
      createdBy: req.user._id,
    });

    return res.status(201).json(announcement);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT /api/announcements/:id  (admin/hr)
export const updateAnnouncement = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid announcement id" });
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.body !== undefined) updates.body = req.body.body;
    else if (req.body.message !== undefined) updates.body = req.body.message;

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    );

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    return res.status(200).json(announcement);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE /api/announcements/:id  (admin/hr)
export const deleteAnnouncement = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid announcement id" });
    }

    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    return res.status(200).json({ message: "Announcement deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};