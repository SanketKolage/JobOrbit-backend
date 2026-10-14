const Notification = require("../models/Notification");

exports.listNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(25);
    return res.json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { title, message, type = "info", metadata = {} } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const notification = await Notification.create({
      userId: req.user.id,
      title,
      message,
      type,
      metadata,
    });

    return res.status(201).json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
