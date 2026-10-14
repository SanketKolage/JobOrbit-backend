const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    url: { type: String, default: "" },
    technologies: [{ type: String }],
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
  },
  { _id: false }
);

const WorkExperienceSchema = new mongoose.Schema(
  {
    company: { type: String, default: "" },
    title: { type: String, default: "" },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    description: { type: String, default: "" },
    highlights: [{ type: String }],
  },
  { _id: false }
);

const EducationSchema = new mongoose.Schema(
  {
    institution: { type: String, default: "" },
    degree: { type: String, default: "" },
    field: { type: String, default: "" },
    graduationYear: { type: String, default: "" },
    gpa: { type: String, default: "" },
  },
  { _id: false }
);

const CertificationSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    issuer: { type: String, default: "" },
    year: { type: String, default: "" },
  },
  { _id: false }
);

const UserProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    preferredLocations: [{ type: String }],
    currentRole: { type: String, default: "" },
    yearsOfExperience: { type: Number, default: 0 },
    education: [EducationSchema],
    skills: [{ type: String }],
    technicalSkills: [{ type: String }],
    softSkills: [{ type: String }],
    projects: [ProjectSchema],
    certifications: [CertificationSchema],
    workExperience: [WorkExperienceSchema],
    preferredJobTitles: [{ type: String }],
    preferredTechnologies: [{ type: String }],
    preferredSalaryRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
    },
    noticePeriod: { type: String, default: "" },
    remotePreference: {
      type: String,
      enum: ["remote", "hybrid", "onsite", "any"],
      default: "any",
    },
    employmentType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Freelance", "Any"],
      default: "Any",
    },
    portfolioUrl: { type: String, default: "" },
    githubUrl: { type: String, default: "" },
    linkedInUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

UserProfileSchema.index({ userId: 1 }, { unique: true, sparse: true });
UserProfileSchema.index({ email: 1 }, { unique: false, sparse: true });

module.exports = mongoose.model("UserProfile", UserProfileSchema);
