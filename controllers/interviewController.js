const Resume = require("../models/Resume");
const Job = require("../models/Job");
const MockInterview = require("../models/MockInterview");
const { generateInterviewPrep, evaluateMockAnswer } = require("../services/interviewService");

exports.prepareInterview = async (req, res) => {
  try {
    const { jobId, resumeId } = req.query;
    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    const job = await Job.findOne({ _id: jobId, userId: req.user.id });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const resume = resumeId
      ? await Resume.findOne({ _id: resumeId, userId: req.user.id })
      : await Resume.findOne({ userId: req.user.id, status: "parsed" }).sort({ createdAt: -1 });

    const prep = generateInterviewPrep(job.toObject(), resume?.parsed || {});
    return res.json({ success: true, prep });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSession = async (req, res) => {
  try {
    const { jobId, applicationId } = req.body || {};
    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    const job = await Job.findOne({ _id: jobId, userId: req.user.id });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const latestResume = await Resume.findOne({ userId: req.user.id, status: "parsed" }).sort({ createdAt: -1 });
    const prep = generateInterviewPrep(job.toObject(), latestResume?.parsed || {});

    const session = await MockInterview.create({
      userId: req.user.id,
      jobId,
      applicationId,
      status: "in_progress",
      questions: prep.questions,
    });

    return res.status(201).json({ success: true, session });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { questionIndex, answer } = req.body || {};
    const session = await MockInterview.findOne({ _id: req.params.id, userId: req.user.id });

    if (!session) {
      return res.status(404).json({ success: false, message: "Interview session not found" });
    }

    const question = session.questions[Number(questionIndex)];
    if (!question) {
      return res.status(400).json({ success: false, message: "Question index is invalid" });
    }

    const evaluation = evaluateMockAnswer(question.question, answer, session.jobId ? await Job.findById(session.jobId) : {});
    session.answers.push({
      questionIndex: Number(questionIndex),
      answer: answer || "",
      score: evaluation.score,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      feedback: evaluation.feedback,
    });

    await session.save();

    return res.json({ success: true, evaluation, session });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.finalizeSession = async (req, res) => {
  try {
    const session = await MockInterview.findOne({ _id: req.params.id, userId: req.user.id });
    if (!session) {
      return res.status(404).json({ success: false, message: "Interview session not found" });
    }

    const scores = session.answers.map((answer) => answer.score || 0);
    const overallScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;

    const allStrengths = session.answers.flatMap((answer) => answer.strengths || []);
    const allGaps = session.answers.flatMap((answer) => answer.gaps || []);

    session.finalEvaluation = {
      overallScore,
      strengths: [...new Set(allStrengths)].slice(0, 6),
      gaps: [...new Set(allGaps)].slice(0, 6),
      summary: "The mock interview focused on role alignment, trade-off reasoning, and communication. Use the feedback to strengthen examples and tie responses directly to job requirements.",
      recommendations: [
        "Prepare 2-3 STAR examples with measurable outcomes.",
        "Connect every answer to the specific job requirements.",
        "Keep explanations concise but concrete.",
      ],
    };

    session.status = "completed";
    await session.save();

    return res.json({ success: true, session, finalEvaluation: session.finalEvaluation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
