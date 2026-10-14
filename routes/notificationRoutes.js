const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  listNotifications,
  createNotification,
  markNotificationRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", listNotifications);
router.post("/", createNotification);
router.patch("/:id/read", markNotificationRead);

module.exports = router;
