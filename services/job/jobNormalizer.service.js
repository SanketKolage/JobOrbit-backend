function normalizeSalary(raw) {
  const min = Number(raw?.min ?? raw?.salaryMin ?? raw?.job_min_salary ?? 0);
  const max = Number(raw?.max ?? raw?.salaryMax ?? raw?.job_max_salary ?? 0);
  const currency = raw?.currency || raw?.salaryCurrency || raw?.job_salary_currency || "USD";

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : min,
    currency,
  };
}

function normalizeRemoteType(raw) {
  if (raw?.remoteType) return raw.remoteType;
  if (raw?.job_is_remote) return "remote";
  if (raw?.remote === "hybrid") return "hybrid";
  if (raw?.isRemote === true) return "remote";
  return "unknown";
}

function toTextArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") return value.split(/\n|,|;/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeJob(raw = {}, source = "jsearch") {
  const title = raw.title || raw.job_title || raw.role || "Unknown Title";
  const company = raw.company || raw.employer_name || raw.companyName || "Unknown Company";
  const location = raw.location
    ? raw.location
    : raw.job_city
      ? `${raw.job_city || ""}${raw.job_state ? `, ${raw.job_state}` : ""}${raw.job_country && !raw.job_state ? `, ${raw.job_country}` : ""}`
      : raw.job_country || "Remote";

  const salary = normalizeSalary(raw);
  const requirements = toTextArray(raw.requirements || raw.job_required_skills || raw.job_highlights?.Qualifications || []);
  const responsibilities = toTextArray(raw.responsibilities || raw.job_highlights?.Responsibilities || []);
  const skills = toTextArray(raw.skills || raw.job_required_skills || raw.job_tech_stack || []);
  const description = raw.description || raw.job_description || "";
  const sourceJobId = raw.sourceJobId || raw.job_id || raw.id || raw.externalId || "";
  const applicationUrl = raw.applicationUrl || raw.job_apply_link || raw.job_google_link || "";
  const postedDate = raw.postedDate || raw.job_posted_at_datetime_utc || new Date();

  return {
    externalId: sourceJobId,
    sourceJobId,
    source,
    title,
    company,
    location: location || "Remote",
    remoteType: normalizeRemoteType(raw),
    isRemote: Boolean(raw.isRemote ?? raw.job_is_remote ?? raw.remoteType === "remote"),
    jobType: raw.jobType || raw.job_employment_type || raw.employmentType || "Full-time",
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salary,
    experienceRequired: raw.experienceRequired || raw.job_required_experience || raw.requiredExperience || "",
    skills,
    description,
    requirements: requirements.slice(0, 12),
    responsibilities: responsibilities.slice(0, 10),
    benefits: Array.isArray(raw.benefits) ? raw.benefits : Array.isArray(raw.job_benefits) ? raw.job_benefits : [],
    applyUrl: applicationUrl,
    companyLogo: raw.companyLogo || raw.employer_logo || null,
    companyWebsite: raw.companyWebsite || raw.employer_website || null,
    postedAt: postedDate ? new Date(postedDate) : new Date(),
    discoveredAt: raw.discoveredAt ? new Date(raw.discoveredAt) : new Date(),
    requirementsRaw: requirements,
    responsibilitiesRaw: responsibilities,
  };
}

module.exports = { normalizeJob };
