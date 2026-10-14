const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "change-me-refresh-token";

function generateToken(user, tokenType = "access") {
  return jwt.sign(
    {
      sub: user._id,
      email: user.email,
      role: user.role || "user",
      tokenType,
    },
    tokenType === "refresh" ? JWT_REFRESH_SECRET : JWT_SECRET,
    { expiresIn: tokenType === "refresh" ? "30d" : "15m" }
  );
}

async function rotateRefreshToken(user, refreshToken) {
  if (!refreshToken) {
    user.refreshTokenHash = null;
    await user.save();
    return;
  }

  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  user.lastLoginAt = new Date();
  await user.save();
}

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      role: "user",
    });

    const accessToken = generateToken(user, "access");
    const refreshToken = generateToken(user, "refresh");
    await rotateRefreshToken(user, refreshToken);

    return res.status(201).json({
      success: true,
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const accessToken = generateToken(user, "access");
    const refreshToken = generateToken(user, "refresh");
    await rotateRefreshToken(user, refreshToken);

    return res.json({
      success: true,
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.sub);
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const newAccessToken = generateToken(user, "access");
    const newRefreshToken = generateToken(user, "refresh");
    await rotateRefreshToken(user, newRefreshToken);

    return res.json({
      success: true,
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }
};

exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshTokenHash = null;
      await user.save();
    }

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
