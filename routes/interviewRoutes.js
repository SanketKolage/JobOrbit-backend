const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  prepareInterview,
  createSession,
  submitAnswer,
  finalizeSession,
} = require("../controllers/interviewController");

const router = express.Router();

router.use(authMiddleware);
router.get("/prep", prepareInterview);
router.post("/sessions", createSession);
router.post("/:id/answer", submitAnswer);
router.post("/:id/finalize", finalizeSession);

module.exports = router;
