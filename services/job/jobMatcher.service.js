function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item)).join(" ");
  if (value == null) return "";
  return String(value);
}

function normalize(value = "") {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s+.#/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asSet(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap((entry) => String(entry || "").split(/[|,&/]+/))
    .map((entry) => normalize(entry))
    .filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseYears(value) {
  if (typeof value === "number") return value;
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
  if (match) return Number(match[1]);
  return 0;
}

function extractMissingSkills(candidateSkills, jobSkills) {
  const candidate = new Set(candidateSkills);
  return jobSkills.filter((skill) => !candidate.has(skill));
}

function buildJobMatchAnalysis(resumeParsed = {}, jobDetails = {}) {
  const candidateSkills = asSet([
    resumeParsed.skills,
    resumeParsed.techStack,
    resumeParsed.technicalSkills,
    resumeParsed.preferredTechnologies,
  ]);

  const jobSkills = asSet([
    jobDetails.skills,
    jobDetails.requirements,
    jobDetails.description,
    jobDetails.responsibilities,
  ]).filter((skill) => skill.length > 2 && !["experience", "developer", "engineer", "team", "role", "work"].includes(skill));

  const matchedSkills = jobSkills.filter((skill) => candidateSkills.includes(skill));
  const missingSkills = jobSkills.filter((skill) => !candidateSkills.includes(skill));

  const yearsOfExperience = Number(resumeParsed.totalYearsExperience || resumeParsed.yearsOfExperience || 0);
  const experienceRequired = parseYears(jobDetails.experienceRequired || jobDetails.description || "");
  const experienceMatch = experienceRequired > 0
    ? clamp(Math.round((yearsOfExperience / experienceRequired) * 100), 0, 100)
    : clamp((yearsOfExperience >= 3 ? 90 : yearsOfExperience >= 1 ? 72 : 55), 0, 100);

  const preferredLocations = asSet(resumeParsed.preferredLocations || resumeParsed.location || []);
  const jobLocation = normalize(jobDetails.location || "");
  const jobRemoteType = jobDetails.remoteType || (jobDetails.isRemote ? "remote" : "unknown");
  const remotePreference = resumeParsed.remotePreference || "any";

  let locationScore = 40;
  if (jobRemoteType === "remote" && ["remote", "any"].includes(remotePreference)) locationScore = 100;
  else if (jobRemoteType === "hybrid" && ["hybrid", "remote", "any"].includes(remotePreference)) locationScore = 85;
  else if (jobLocation && preferredLocations.some((loc) => jobLocation.includes(loc) || loc.includes(jobLocation))) locationScore = 100;
  else if (jobRemoteType === "onsite" && resumeParsed.location && jobLocation.includes(normalize(resumeParsed.location))) locationScore = 80;
  else locationScore = 50;

  const preferredTitles = asSet(resumeParsed.preferredJobTitles || resumeParsed.targetRoles || []);
  const titleScore = preferredTitles.length > 0
    ? clamp(Math.round((preferredTitles.filter((title) => normalize(jobDetails.title || "").includes(title)).length / preferredTitles.length) * 100), 35, 100)
    : 70;

  const jobRequirementText = normalize(toText(jobDetails.requirements || jobDetails.description || ""));
  const educationScore = resumeParsed.education?.length
    ? /bachelor|degree|masters|master|phd|associate|diploma/i.test(jobRequirementText)
      ? 90
      : 75
    : 70;

  const candidateSalary = Number(resumeParsed.preferredSalaryRange?.min || 0);
  const salaryMin = Number(jobDetails.salaryMin || 0);
  let preferenceScore = 72;
  if (jobDetails.employmentType && resumeParsed.employmentType === jobDetails.employmentType) preferenceScore = 95;
  if (salaryMin && candidateSalary && salaryMin <= candidateSalary * 1.2) preferenceScore = 90;
  if (jobRemoteType === "remote" && ["remote", "any"].includes(remotePreference)) preferenceScore = 95;

  const skillMatchScore = jobSkills.length > 0
    ? clamp(Math.round((matchedSkills.length / jobSkills.length) * 100), 0, 100)
    : 0;

  const overallMatchScore = clamp(Math.round(
    (skillMatchScore * 0.35) +
    (experienceMatch * 0.2) +
    (locationScore * 0.15) +
    (titleScore * 0.15) +
    (educationScore * 0.1) +
    (preferenceScore * 0.05)
  ), 0, 100);

  const strengths = [];
  if (matchedSkills.length) strengths.push(`Strong alignment on ${matchedSkills.slice(0, 3).join(", ")}`);
  if (experienceMatch >= 75) strengths.push("Experience level is well aligned with the role");
  if (locationScore >= 85) strengths.push("Location and work style match your preferences");

  const gaps = [];
  if (missingSkills.length) gaps.push(`Missing skills: ${missingSkills.slice(0, 3).join(", ")}`);
  if (experienceMatch < 70) gaps.push("Experience depth is lower than the role’s target profile");
  if (locationScore < 70) gaps.push("The location/work setup may not match your preferences");

  const explanation = overallMatchScore >= 80
    ? `Strong match because the role closely aligns with your ${matchedSkills.slice(0, 3).join(", ") || "core skills"}, experience level, and preference profile.`
    : overallMatchScore >= 60
      ? `Good potential fit because the role overlaps with your core experience and skills, though a few gaps remain in ${missingSkills.slice(0, 2).join(", ") || "role-specific requirements"}.`
      : `Moderate fit: your background is relevant, but the role still needs stronger alignment in ${missingSkills.slice(0, 2).join(", ") || "a few key areas"}.`;

  return {
    overallMatchScore,
    skillMatchScore,
    experienceMatchScore: experienceMatch,
    locationMatchScore: locationScore,
    titleMatchScore: titleScore,
    educationMatchScore: educationScore,
    preferenceMatchScore: preferenceScore,
    score: overallMatchScore,
    strengths: strengths.slice(0, 4),
    gaps: extractMissingSkills(candidateSkills, missingSkills).length > 0
      ? extractMissingSkills(candidateSkills, missingSkills).slice(0, 3).map((skill) => `Missing skill: ${skill}`)
      : gaps.slice(0, 3),
    recommendation: overallMatchScore >= 70 ? "Recommended to apply" : "Consider applying only if the role is a strong fit",
    shouldApply: overallMatchScore >= 70,
    explanation,
    matchedSkills: matchedSkills.slice(0, 6),
    missingSkills: missingSkills.slice(0, 6),
  };
}

module.exports = { buildJobMatchAnalysis };
