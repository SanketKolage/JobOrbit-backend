const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    // Source data
    externalId: { type: String },
    sourceJobId: { type: String },
    source: { type: String, default: "jsearch" },

    // Job details
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String },
    remoteType: { type: String, enum: ["remote", "hybrid", "onsite", "unknown"], default: "unknown" },
    isRemote: { type: Boolean, default: false },
    jobType: { type: String },
    salaryMin: { type: Number, default: 0 },
    salaryMax: { type: Number, default: 0 },
    salaryCurrency: { type: String, default: "USD" },
    salary: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
    },
    experienceRequired: { type: String, default: "" },
    description: { type: String },
    requirements: [String],
    responsibilities: [String],
    benefits: [String],
    skills: [String],
    applyUrl: { type: String },
    companyLogo: { type: String },
    companyWebsite: { type: String },
    postedAt: { type: Date },
    discoveredAt: { type: Date, default: Date.now },
    deadline: { type: Date },

    // AI Match scoring (linked to a resume)
    aiMatch: {
      resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
      score: { type: Number, min: 0, max: 100 },
      strengths: [String],
      gaps: [String],
      recommendation: String,
      scoredAt: Date,
    },

    // Status
    isSaved: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

JobSchema.index({ userId: 1, createdAt: -1 });
JobSchema.index({ source: 1, sourceJobId: 1 }, { unique: false });
JobSchema.index({ title: "text", company: "text", description: "text" });
JobSchema.index({ "aiMatch.score": -1 });

module.exports = mongoose.model("Job", JobSchema);
