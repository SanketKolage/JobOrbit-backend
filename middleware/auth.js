const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

module.exports = function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.tokenType && decoded.tokenType !== "access") {
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || "user",
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports.requireAdmin = function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  return next();
};
