const Resume = require("../models/Resume");
const UserProfile = require("../models/UserProfile");

function cleanStringArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function defaultProfile() {
  return {
    name: "",
    email: "",
    phone: "",
    location: "",
    preferredLocations: [],
    currentRole: "",
    yearsOfExperience: 0,
    education: [],
    skills: [],
    technicalSkills: [],
    softSkills: [],
    projects: [],
    certifications: [],
    workExperience: [],
    preferredJobTitles: [],
    preferredTechnologies: [],
    preferredSalaryRange: { min: 0, max: 0, currency: "USD" },
    noticePeriod: "",
    remotePreference: "any",
    employmentType: "Any",
    portfolioUrl: "",
    githubUrl: "",
    linkedInUrl: "",
  };
}

function fromResume(resume) {
  const parsed = resume?.parsed || {};
  return {
    name: parsed.name || "",
    email: parsed.email || "",
    phone: parsed.phone || "",
    location: parsed.location || "",
    currentRole: (parsed.targetRoles && parsed.targetRoles[0]) || "",
    yearsOfExperience: Number(parsed.totalYearsExperience || 0),
    education: Array.isArray(parsed.education) ? parsed.education : [],
    skills: cleanStringArray(parsed.skills || []),
    technicalSkills: cleanStringArray(parsed.techStack || []),
    softSkills: [],
    projects: [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    workExperience: Array.isArray(parsed.experience) ? parsed.experience : [],
    preferredJobTitles: Array.isArray(parsed.targetRoles) ? parsed.targetRoles : [],
    preferredTechnologies: cleanStringArray(parsed.techStack || []),
    preferredSalaryRange: { min: 0, max: 0, currency: "USD" },
    noticePeriod: "",
    remotePreference: "any",
    employmentType: "Any",
    portfolioUrl: parsed.portfolio || "",
    githubUrl: parsed.github || "",
    linkedInUrl: parsed.linkedIn || "",
  };
}

async function ensureProfile(userId) {
  if (!userId) throw new Error("User context is required");

  let profile = await UserProfile.findOne({ userId }).sort({ createdAt: -1 });

  if (profile) return profile;

  const latestResume = await Resume.findOne({ userId, status: "parsed" }).sort({ createdAt: -1 });
  const baseProfile = latestResume ? { ...fromResume(latestResume), userId } : { ...defaultProfile(), userId };
  profile = await UserProfile.create(baseProfile);
  return profile;
}

exports.getProfile = async (req, res) => {
  try {
    const profile = await ensureProfile(req.user.id);
    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const existing = await ensureProfile(req.user.id);
    const payload = {
      ...existing.toObject(),
      ...req.body,
      userId: req.user.id,
      preferredLocations: cleanStringArray(req.body.preferredLocations),
      skills: cleanStringArray(req.body.skills),
      technicalSkills: cleanStringArray(req.body.technicalSkills),
      softSkills: cleanStringArray(req.body.softSkills),
      preferredJobTitles: cleanStringArray(req.body.preferredJobTitles),
      preferredTechnologies: cleanStringArray(req.body.preferredTechnologies),
      preferredSalaryRange: {
        min: Number(req.body.preferredSalaryRange?.min || 0),
        max: Number(req.body.preferredSalaryRange?.max || 0),
        currency: req.body.preferredSalaryRange?.currency || "USD",
      },
    };

    const profile = await UserProfile.findByIdAndUpdate(existing._id, payload, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.syncProfileFromResume = async (req, res) => {
  try {
    const latestResume = await Resume.findOne({ userId: req.user.id, status: "parsed" }).sort({ createdAt: -1 });

    if (!latestResume) {
      return res.status(404).json({ success: false, message: "No parsed resume found to sync from" });
    }

    const profileData = { ...fromResume(latestResume), userId: req.user.id };
    const existing = await ensureProfile(req.user.id);
    const profile = await UserProfile.findByIdAndUpdate(
      existing._id,
      { ...existing.toObject(), ...profileData },
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: "Profile synced from latest resume", profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
