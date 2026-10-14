const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    rawText: { type: String },

    // AI-parsed structured data
    parsed: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      location: { type: String },
      linkedIn: { type: String },
      github: { type: String },
      portfolio: { type: String },
      summary: { type: String },

      skills: [{ type: String }],
      techStack: [{ type: String }],

      experience: [
        {
          company: String,
          title: String,
          startDate: String,
          endDate: String,
          description: String,
          highlights: [String],
        },
      ],

      education: [
        {
          institution: String,
          degree: String,
          field: String,
          graduationYear: String,
          gpa: String,
        },
      ],

      certifications: [{ name: String, issuer: String, year: String }],
      languages: [String],
      totalYearsExperience: Number,
      seniorityLevel: {
        type: String,
        enum: ["Intern", "Junior", "Mid", "Senior", "Lead", "Principal", "Executive"],
      },
      targetRoles: [String],
      industryFocus: [String],
    },

    status: {
      type: String,
      enum: ["uploaded", "parsing", "parsed", "error"],
      default: "uploaded",
    },

    parseError: String,
  },
  { timestamps: true }
);

ResumeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Resume", ResumeSchema);
