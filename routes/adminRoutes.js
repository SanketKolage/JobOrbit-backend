const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getOverview, getUsers, updateUserRole } = require("../controllers/adminController");

const router = express.Router();

router.use(authMiddleware);
router.use(authMiddleware.requireAdmin);

router.get("/overview", getOverview);
router.get("/users", getUsers);
router.patch("/users/:userId/role", updateUserRole);

module.exports = router;
