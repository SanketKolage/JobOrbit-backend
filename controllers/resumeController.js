const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Resume = require("../models/Resume");
const aiService = require("../services/aiService");

// ── Extract raw text from file ─────────────────────────────────────────────────
async function extractText(filePath, mimetype) {
  const fileBuffer = fs.readFileSync(filePath);

  if (mimetype === "application/pdf") {
    const data = await pdfParse(fileBuffer);
    return data.text;
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  if (mimetype === "text/plain") {
    return fileBuffer.toString("utf8");
  }

  throw new Error("Unsupported file type");
}

// ── POST /api/resume/upload ────────────────────────────────────────────────────
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const resume = new Resume({
      userId: req.user.id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      status: "parsing",
    });
    await resume.save();

    // Extract text
    let rawText;
    try {
      rawText = await extractText(req.file.path, req.file.mimetype);
      resume.rawText = rawText;
    } catch (err) {
      resume.status = "error";
      resume.parseError = "Could not extract text: " + err.message;
      await resume.save();
      return res.status(422).json({
        success: false,
        message: "Could not read file. Please ensure it is a valid PDF, DOCX, or TXT.",
      });
    }
    function normalizeResume(data = {}) {
      return {
        ...data,
        seniorityLevel: normalizeSeniorityLevel(data.seniorityLevel),
        skills: Array.isArray(data.skills) ? data.skills : [],
        techStack: Array.isArray(data.techStack) ? data.techStack : [],
        languages: Array.isArray(data.languages) ? data.languages : [],
        targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : [],
        industryFocus: Array.isArray(data.industryFocus)
          ? data.industryFocus
          : [],
    
        experience: Array.isArray(data.experience)
          ? data.experience.map((exp) => ({
              company: exp.company || "",
              title: exp.title || "",
              startDate: exp.startDate || "",
              endDate: exp.endDate || "",
    
              description: Array.isArray(exp.description)
                ? exp.description.join(". ")
                : String(exp.description || ""),
    
              highlights: Array.isArray(exp.highlights)
                ? exp.highlights
                : [],
            }))
          : [],
    
        education: Array.isArray(data.education)
          ? data.education.map((edu) => ({
              institution: edu.institution || "",
              degree: edu.degree || "",
              field: edu.field || "",
              graduationYear: edu.graduationYear || "",
              gpa: edu.gpa || null,
            }))
          : [],
    
        certifications: Array.isArray(data.certifications)
          ? data.certifications.map((cert) => ({
              name: cert.name || "",
              issuer: cert.issuer || "",
              year: cert.year || "",
            }))
          : [],
      };
      
    }
    function normalizeSeniorityLevel(level) {
      const value = (level || "").toLowerCase();
    
      if (value.includes("junior")) return "Junior";
      if (value.includes("mid")) return "Mid";
      if (value.includes("senior")) return "Senior";
      if (value.includes("lead")) return "Lead";
      if (value.includes("principal")) return "Principal";
      if (value.includes("executive")) return "Executive";
    
      return "Junior";
    }
    // AI parse resume
    try {
      const parsed = await aiService.parseResume(rawText);

      resume.parsed = normalizeResume(parsed);
      resume.status = "parsed";
    } catch (err) {
      console.error("Gemini Parse Error:", err);
    
      resume.status = "error";
      resume.parseError = err.message;
    
      await resume.save();
    
      return res.status(422).json({
        success: false,
        message: "AI parsing failed",
        error: err.message,
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      });
    }

    await resume.save();

    res.status(201).json({
      success: true,
      message: "Resume uploaded and parsed successfully",
      resume,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/resume ────────────────────────────────────────────────────────────
exports.getAllResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.id }).sort({ createdAt: -1 }).select("-rawText");
    res.json({ success: true, resumes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/resume/:id ────────────────────────────────────────────────────────
exports.getResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user.id });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });
    res.json({ success: true, resume });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE /api/resume/:id ─────────────────────────────────────────────────────
exports.deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user.id });
    if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });

    if (fs.existsSync(resume.filePath)) {
      fs.unlinkSync(resume.filePath);
    }

    await Resume.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Resume deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
