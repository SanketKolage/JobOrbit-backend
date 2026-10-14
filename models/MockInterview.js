const mongoose = require("mongoose");

const QuestionEntrySchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    whyAsk: { type: String, default: "" },
    expectedConcepts: [{ type: String }],
    guidance: { type: String, default: "" },
  },
  { _id: false }
);

const AnswerEntrySchema = new mongoose.Schema(
  {
    questionIndex: { type: Number, required: true },
    answer: { type: String, required: true },
    score: { type: Number, default: 0 },
    strengths: [{ type: String }],
    gaps: [{ type: String }],
    feedback: { type: String, default: "" },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MockInterviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    status: {
      type: String,
      enum: ["draft", "in_progress", "completed"],
      default: "draft",
    },
    questions: [QuestionEntrySchema],
    answers: [AnswerEntrySchema],
    finalEvaluation: {
      overallScore: { type: Number, default: 0 },
      strengths: [{ type: String }],
      gaps: [{ type: String }],
      summary: { type: String, default: "" },
      recommendations: [{ type: String }],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MockInterview", MockInterviewSchema);
