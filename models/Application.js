const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    // Application details
    // status: {
    //   type: String,
    //   enum: [
    //     "draft",
    //     "ready",
    //     "applied",
    //     "viewed",
    //     "interviewing",
    //     "offer",
    //     "rejected",
    //     "withdrawn",
    //   ],
    //   default: "draft",
    // },
    status: {
      type: String,
      enum: [
        "new",
        "pending",
        "applying",
        "tailored",
        "ready",
        "applied",
        "viewed",
        "interviewing",
        "offer",
        "approved",
        "failed",
        "manual_action_required",
        "rejected",
        "withdrawn",
      ],
      default: "new",
    },
    // AI-generated cover letter
    coverLetter: {
      content: String,
      generatedAt: Date,
      customized: Boolean,
    },

    // AI-optimized resume tailoring notes
    resumeTailoring: {
      suggestions: [String],
      keywordsToAdd: [String],
      generatedAt: Date,
    },
    resumePdf:{
      type:String
    },
    autoApplyEligible:{
      type:Boolean,
      default:false
     },
    tailoredResume: {
      summary: String,
      skills: [String],
      experience: [Object],
      projects: [Object],
      atsScore: Number,
      generatedAt: Date
    },
    // Application method
    appliedVia: {
      type: String,
      enum: ["email", "portal", "linkedin", "manual", "auto"],
    },
    appliedAt: Date,
    applicationUrl: String,

    // Follow-up tracking
    followUps: [
      {
        date: Date,
        type: { type: String, enum: ["email", "linkedin", "phone", "other"] },
        notes: String,
      },
    ],

    // Interview tracking
    interviews: [
      {
        scheduledAt: Date,
        type: { type: String, enum: ["phone", "video", "onsite", "technical"] },
        interviewers: [String],
        notes: String,
        outcome: String,
      },
    ],

    notes: String,
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  },
 
  { timestamps: true }
);

ApplicationSchema.index({ userId: 1, createdAt: -1 });
ApplicationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("Application", ApplicationSchema);
