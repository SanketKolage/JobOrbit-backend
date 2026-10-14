const User = require("../models/User");
const Resume = require("../models/Resume");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Notification = require("../models/Notification");

exports.getOverview = async (req, res) => {
  try {
    const [users, resumes, jobs, applications, notifications] = await Promise.all([
      User.countDocuments(),
      Resume.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      Notification.countDocuments({ userId: req.user.id }),
    ]);

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt");
    const recentApplications = await Application.find().sort({ createdAt: -1 }).limit(5).populate("jobId", "title company");

    return res.json({
      success: true,
      overview: {
        users,
        resumes,
        jobs,
        applications,
        notifications,
      },
      recentUsers,
      recentApplications,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("-password");
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Valid role is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
