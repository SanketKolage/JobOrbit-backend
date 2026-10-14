const Job = require("../models/Job");
const Resume = require("../models/Resume");
const jobSearchService = require("../services/jobSearchService");
const aiService = require("../services/aiService");
const { upsertUniqueJobs } = require("../services/job/duplicateDetector.service");

// ── POST /api/jobs/search ──────────────────────────────────────────────────────
exports.searchJobs = async (req, res) => {
  try {
    const { query, location, jobType, isRemote, resumeId, page } = req.body;
    const userId = req.user.id;

    let searchQuery = query;

    // Auto-build query from resume if resumeId provided
    let resumeParsed = null;
    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, userId });
      if (resume?.parsed) {
        resumeParsed = resume.parsed;
        if (!query) {
          const topRole = (resume.parsed.targetRoles || [])[0] || "software developer";
          const topSkills = (resume.parsed.techStack || resume.parsed.skills || [])
            .slice(0, 2)
            .join(" ");
          searchQuery = `${topRole} ${topSkills}`.trim();
        }
      }
    }

    // Fetch from API
    const jobsRaw = await jobSearchService.searchJobs({
      query: searchQuery,
      location,
      jobType,
      isRemote,
      page: page || 1,
    });

    const savedJobs = await upsertUniqueJobs(jobsRaw.map((jobData) => ({
      ...jobData,
      externalId: jobData.externalId || jobData.sourceJobId,
      sourceJobId: jobData.sourceJobId || jobData.externalId,
      source: jobData.source || "jsearch",
      userId,
    })), userId);

    // If resume provided, batch score all jobs
    if (resumeParsed && savedJobs.length > 0) {
      const scores = await aiService.batchScoreJobs(resumeParsed, savedJobs);
      for (const scoreResult of scores) {
        await Job.findOneAndUpdate({ _id: scoreResult.jobId, userId }, {
          aiMatch: {
            resumeId,
            score: scoreResult.score,
            strengths: scoreResult.strengths,
            gaps: scoreResult.gaps,
            recommendation: scoreResult.recommendation,
            scoredAt: new Date(),
            overallMatchScore: scoreResult.overallMatchScore,
            skillMatchScore: scoreResult.skillMatchScore,
            experienceMatchScore: scoreResult.experienceMatchScore,
            locationMatchScore: scoreResult.locationMatchScore,
            titleMatchScore: scoreResult.titleMatchScore,
            educationMatchScore: scoreResult.educationMatchScore,
            preferenceMatchScore: scoreResult.preferenceMatchScore,
            matchedSkills: scoreResult.matchedSkills,
            missingSkills: scoreResult.missingSkills,
            explanation: scoreResult.explanation,
          },
        });
      }
      const scoredJobs = await Job.find({
        _id: { $in: savedJobs.map((j) => j._id) },
        userId,
      }).sort({ "aiMatch.score": -1 });

      return res.json({ success: true, jobs: scoredJobs, total: scoredJobs.length });
    }

    res.json({ success: true, jobs: savedJobs, total: savedJobs.length });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/jobs/:id/score ───────────────────────────────────────────────────
exports.scoreJob = async (req, res) => {
  try {
    const { resumeId } = req.body;
    const job = await Job.findOne({ _id: req.params.id, userId: req.user.id });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    const resume = await Resume.findOne({ _id: resumeId, userId: req.user.id });
    if (!resume?.parsed) {
      return res.status(404).json({ success: false, message: "Resume not found or not parsed" });
    }

    const match = await aiService.scoreJobMatch(resume.parsed, job);

    job.aiMatch = {
      resumeId,
      score: match.score,
      strengths: match.strengths,
      gaps: match.gaps,
      recommendation: match.recommendation,
      scoredAt: new Date(),
      overallMatchScore: match.overallMatchScore,
      skillMatchScore: match.skillMatchScore,
      experienceMatchScore: match.experienceMatchScore,
      locationMatchScore: match.locationMatchScore,
      titleMatchScore: match.titleMatchScore,
      educationMatchScore: match.educationMatchScore,
      preferenceMatchScore: match.preferenceMatchScore,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      explanation: match.explanation,
    };
    await job.save();

    res.json({ success: true, match, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/jobs ──────────────────────────────────────────────────────────────
exports.getJobs = async (req, res) => {
  try {
    const { resumeId, minScore, saved, page = 1, limit = 20 } = req.query;
    const filter = { isHidden: false, userId: req.user.id };

    if (saved === "true") filter.isSaved = true;
    if (resumeId) filter["aiMatch.resumeId"] = resumeId;
    if (minScore) filter["aiMatch.score"] = { $gte: parseInt(minScore) };

    const total = await Job.countDocuments(filter);
    const jobs = await Job.find(filter)
      .sort({ "aiMatch.score": -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, jobs, total, page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/jobs/:id ──────────────────────────────────────────────────────────
exports.getJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, userId: req.user.id });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/jobs/:id/save ───────────────────────────────────────────────────
exports.toggleSave = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, userId: req.user.id });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    job.isSaved = !job.isSaved;
    await job.save();

    res.json({ success: true, isSaved: job.isSaved });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── PATCH /api/jobs/:id/hide ───────────────────────────────────────────────────
exports.hideJob = async (req, res) => {
  try {
    await Job.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isHidden: true });
    res.json({ success: true, message: "Job hidden" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
