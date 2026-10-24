import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

// Doosre controllers (leave, attendance, etc.) is helper se notification bana sakte hain
export const createNotification = async ({
  user,
  title,
  message = "",
  type = "info",
  link = "",
}) => Notification.create({ user, title, message, type, link });

// GET /api/notifications?unread=true
export const getNotifications = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.unread === "true") filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json(notification);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true },
    );
    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/notifications  (sirf admin/hr) - testing ya manual notice ke liye
export const sendNotification = async (req, res) => {
  try {
    const { userId, title, message, type, link } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    // userId na ho to sab active users ko bhejo
    if (!userId) {
      const users = await User.find({ active: true }).select("_id");
      await Notification.insertMany(
        users.map((u) => ({ user: u._id, title, message, type, link })),
      );
      return res
        .status(201)
        .json({ message: `Sent to ${users.length} users` });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const notification = await createNotification({
      user: userId,
      title,
      message,
      type,
      link,
    });
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};