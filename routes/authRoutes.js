const express = require("express");
const { signup, login, logout, refreshToken, getCurrentUser } = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.post("/refresh", refreshToken);
router.get("/me", authMiddleware, getCurrentUser);

module.exports = router;
