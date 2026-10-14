const express = require("express");
const authMiddleware = require("../middleware/auth");
const { retrieveRelevantContext } = require("../services/ragService");

const router = express.Router();

router.use(authMiddleware);

router.get("/health", (req, res) => {
  res.json({ success: true, ok: true, service: "ai-rag" });
});

router.post("/rag/search", (req, res) => {
  try {
    const { query = "", documents = [], limit = 5 } = req.body || {};
    const results = retrieveRelevantContext(documents, query, Number(limit) || 5);
    return res.json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
