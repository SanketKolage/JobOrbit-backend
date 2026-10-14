const Application = require("../models/Application");
const Job = require("../models/Job");
const Resume = require("../models/Resume");
const aiService = require("../services/aiService");
const emailService = require("../services/emailService");

const AUTO_APPLY_STATUS_VALUES = [
  "new",
  "pending",
  "applying",
  "tailored",
  "ready",
  "applied",
  "failed",
  "manual_action_required",
  "rejected",
  "withdrawn",
];

const STATUS_VALUES = [
  "pending",
  "tailored",
  "ready",
  "applied",
  "viewed",
  "interviewing",
  "offer",
  "approved",
  "rejected",
  "withdrawn",
];

function normalizeStatus(status) {
  if (!status) return "new";

  const normalized = String(status).trim().toLowerCase();
  const mapping = {
    draft: "new",
    failed: "failed",
    success: "applied",
    "manual action required": "manual_action_required",
    "manual-action-required": "manual_action_required",
    applying: "applying",
  };

  if (STATUS_VALUES.includes(normalized)) return normalized;
  if (AUTO_APPLY_STATUS_VALUES.includes(normalized)) return normalized;
  if (mapping[normalized]) return mapping[normalized];

  return "new";
}

// ── POST /api/applications ─────────────────────────────────────────────────────
exports.createApplication = async (req, res) => {
  try {
    const { resumeId, jobId, priority } = req.body;

    const existing = await Application.findOne({ userId: req.user.id, resumeId, jobId });
    if (existing) {
      return res.status(409).json({ success: false, message: "Application already exists", application: existing });
    }

    const application = new Application({ userId: req.user.id, resumeId, jobId, priority: priority || "medium", status: "new" });
    await application.save();

    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.autoApplyJobs = async (req, res) => {
  try {
    const { resumeId, jobIds = [] } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, message: "Resume is required for auto apply." });
    }

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user.id });
    if (!resume?.parsed) {
      return res.status(400).json({ success: false, message: "Resume not parsed or missing." });
    }

    const results = [];
    for (const jobId of jobIds) {
      const job = await Job.findById(jobId);
      if (!job) {
        results.push({ jobId, status: "failed", message: "Job not found" });
        continue;
      }

      const existing = await Application.findOne({ userId: req.user.id, resumeId, jobId });
      if (existing) {
        results.push({ jobId, status: existing.status || "new" });
        continue;
      }

      const app = new Application({
        userId: req.user.id,
        resumeId,
        jobId,
        status: "applying",
        autoApplyEligible: !!job.applyUrl,
        notes: "Auto Apply started",
      });

      const hasDirectApply = !!job.applyUrl && /^https?:\/\//i.test(job.applyUrl);
      const blockedByManualCheck = !hasDirectApply || /captcha|otp|login|verify|manual/i.test(`${job.title} ${job.company} ${job.description || ""}`);

      app.status = blockedByManualCheck ? "manual_action_required" : "applying";
      app.notes = blockedByManualCheck
        ? "Manual Action Required: direct apply link blocked or login/verification required."
        : "Auto Apply initiated; submission requires live external confirmation";

      await app.save();

      if (blockedByManualCheck) {
        results.push({ jobId, status: "manual_action_required", message: app.notes });
        continue;
      }

      const confirmed = false;
      if (confirmed) {
        app.status = "applied";
        app.appliedAt = new Date();
        app.appliedVia = "auto";
        app.applicationUrl = job.applyUrl;
        await app.save();
        results.push({ jobId, status: "applied" });
      } else {
        app.status = "failed";
        app.notes = "Submission was not confirmed by the external job system.";
        await app.save();
        results.push({ jobId, status: "failed", message: "Submission not confirmed; manual review required." });
      }
    }

    return res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/applications ──────────────────────────────────────────────────────
exports.getApplications = async (req, res) => {
  try {
    const { status, resumeId } = req.query;
    const filter = { userId: req.user.id };
    if (status) filter.status = status;
    if (resumeId) filter.resumeId = resumeId;

    const applications = await Application.find(filter)
      .populate("resumeId", "parsed.name parsed.email fileName")
      .populate("jobId", "title company location jobType applyUrl companyLogo aiMatch isRemote")
      .sort({ createdAt: -1 });

    res.json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/applications/:id ──────────────────────────────────────────────────
exports.getApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("resumeId")
      .populate("jobId");
    if (!application) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/applications/:id/status ────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const normalizedStatus = normalizeStatus(status);
    const update = { status: normalizedStatus };
    if (notes) update.notes = notes;
    if (normalizedStatus === "applied" && !req.body.appliedAt) update.appliedAt = new Date();
    if (normalizedStatus === "approved") update.approvedAt = new Date();

    const application = await Application.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, update, { new: true });
    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateTailoredResume = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("resumeId")
      .populate("jobId");

    if (!application) return res.status(404).json({ success: false, message: "Not found" });

    const tailored = await aiService.generateTailoredResume(
      application.resumeId.parsed,
      application.jobId
    );

    application.status = "tailored";
    application.tailoredResume = {
      ...tailored,
      generatedAt: new Date(),
    };

    await application.save();

    res.json({
      success: true,
      tailoredResume: application.tailoredResume,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ── POST /api/applications/:id/cover-letter ────────────────────────────────────
exports.generateCoverLetter = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("resumeId")
      .populate("jobId");

    if (!application) return res.status(404).json({ success: false, message: "Not found" });
    if (!application.resumeId?.parsed) return res.status(400).json({ success: false, message: "Resume not parsed" });

    const content = await aiService.generateCoverLetter(
      application.resumeId.parsed,
      application.jobId
    );

    application.coverLetter = { content, generatedAt: new Date(), customized: false };
    await application.save();

    res.json({ success: true, coverLetter: application.coverLetter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/applications/:id/tailoring ──────────────────────────────────────
exports.generateTailoring = async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("resumeId")
      .populate("jobId");

    if (!application) return res.status(404).json({ success: false, message: "Not found" });

    const suggestions = await aiService.generateTailoringSuggestions(
      application.resumeId.parsed,
      application.jobId
    );

    application.resumeTailoring = { ...suggestions, generatedAt: new Date() };
    await application.save();

    res.json({ success: true, tailoring: application.resumeTailoring });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/applications/:id/send-email ─────────────────────────────────────
exports.sendEmail = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: "Recipient email required" });

    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("resumeId")
      .populate("jobId");

    if (!application?.coverLetter?.content) {
      return res.status(400).json({ success: false, message: "Generate a cover letter first" });
    }

    const emailMeta = await aiService.generateApplicationEmail(
      application.resumeId.parsed,
      application.jobId,
      application.coverLetter.content
    );

    await emailService.sendApplicationEmail({
      to,
      subject: emailMeta.subject,
      intro: emailMeta.intro,
      coverLetter: application.coverLetter.content,
      resumeFilePath: application.resumeId.filePath,
      candidateName: application.resumeId.parsed.name,
      candidateEmail: application.resumeId.parsed.email,
    });

    application.status = "applied";
    application.appliedAt = new Date();
    application.appliedVia = "email";
    application.applicationUrl = `mailto:${to}`;
    if (application.resumeId?.filePath) {
      application.resumePdf = application.resumeId.filePath;
    }
    await application.save();

    res.json({ success: true, message: "Application email sent successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/applications/:id/follow-up ──────────────────────────────────────
exports.addFollowUp = async (req, res) => {
  try {
    const { type, notes, to } = req.body;

    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id })
      .populate("resumeId")
      .populate("jobId");

    if (!application) return res.status(404).json({ success: false, message: "Not found" });

    // Send follow-up email if email type and recipient
    if (type === "email" && to) {
      await emailService.sendFollowUpEmail({
        to,
        candidateName: application.resumeId.parsed.name,
        candidateEmail: application.resumeId.parsed.email,
        jobTitle: application.jobId.title,
        companyName: application.jobId.company,
        appliedDate: application.appliedAt?.toLocaleDateString() || "recently",
      });
    }

    application.followUps.push({ date: new Date(), type, notes });
    await application.save();

    res.json({ success: true, followUps: application.followUps });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/applications/:id/interview ──────────────────────────────────────
exports.addInterview = async (req, res) => {
  try {
    const { scheduledAt, type, interviewers, notes } = req.body;

    const application = await Application.findOne({ _id: req.params.id, userId: req.user.id });
    if (!application) return res.status(404).json({ success: false, message: "Not found" });

    application.interviews.push({ scheduledAt, type, interviewers, notes });
    application.status = "interviewing";
    await application.save();

    res.json({ success: true, interviews: application.interviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/applications/:id/cover-letter ──────────────────────────────────
exports.updateCoverLetter = async (req, res) => {
  try {
    const { content } = req.body;
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { "coverLetter.content": content, "coverLetter.customized": true },
      { new: true }
    );
    res.json({ success: true, coverLetter: application.coverLetter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/applications/:id ──────────────────────────────────────────────
exports.deleteApplication = async (req, res) => {
  try {
    await Application.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true, message: "Application deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/applications/stats ────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { resumeId } = req.query;
    const filter = { userId: req.user.id };
    if (resumeId) filter.resumeId = resumeId;

    const stats = await Application.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const total = await Application.countDocuments(filter);
    const statusMap = {};
    stats.forEach((s) => (statusMap[s._id] = s.count));

    const normalized = {
      total,
      pending: statusMap.pending || 0,
      tailored: statusMap.tailored || 0,
      ready: statusMap.ready || 0,
      applied: statusMap.applied || 0,
      viewed: statusMap.viewed || 0,
      interviewing: statusMap.interviewing || 0,
      offer: statusMap.offer || 0,
      approved: statusMap.approved || 0,
      rejected: statusMap.rejected || 0,
      withdrawn: statusMap.withdrawn || 0,
      draft: statusMap.pending || 0,
    };

    res.json({ success: true, stats: normalized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
