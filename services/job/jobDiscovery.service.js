const axios = require("axios");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "jsearch.p.rapidapi.com";

async function searchJSearch({ query, location, jobType, isRemote, page = 1, numPages = 2 }) {
  if (!RAPIDAPI_KEY) {
    throw new Error("RAPIDAPI_KEY not configured. Please add it to your .env file.");
  }

  const params = {
    query: query || "software developer",
    page: String(page),
    num_pages: String(numPages),
    date_posted: "month",
    remote_jobs_only: isRemote ? "true" : "false",
  };

  if (location) params.location = location;
  if (jobType) params.employment_types = String(jobType).toUpperCase();

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(`https://${RAPIDAPI_HOST}/search`, {
        params,
        headers: {
          "x-rapidapi-host": RAPIDAPI_HOST,
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
        timeout: 15000,
      });

      const jobs = Array.isArray(response.data?.data) ? response.data.data : [];
      return jobs.map((item) => ({
        title: item.job_title || "Unknown Title",
        company: item.employer_name || "Unknown Company",
        location: item.job_city ? `${item.job_city}${item.job_state ? `, ${item.job_state}` : ""}${item.job_country && !item.job_state ? `, ${item.job_country}` : ""}` : item.job_country || "Remote",
        remoteType: item.job_is_remote ? "remote" : "unknown",
        jobType: item.job_employment_type || "Full-time",
        salaryMin: item.job_min_salary || 0,
        salaryMax: item.job_max_salary || 0,
        salaryCurrency: item.job_salary_currency || "USD",
        description: item.job_description || "",
        requirements: item.job_required_skills || [],
        responsibilities: item.job_highlights?.Responsibilities || [],
        skills: item.job_required_skills || [],
        source: "jsearch",
        sourceJobId: item.job_id,
        applicationUrl: item.job_apply_link || item.job_google_link || "",
        companyLogo: item.employer_logo || null,
        companyWebsite: item.employer_website || null,
        postedDate: item.job_posted_at_datetime_utc || new Date(),
        foundAt: new Date(),
        isRemote: Boolean(item.job_is_remote),
        remote: item.job_is_remote ? "remote" : "",
        salary: {
          min: Number(item.job_min_salary || 0),
          max: Number(item.job_max_salary || 0),
          currency: item.job_salary_currency || "USD",
        },
        experienceRequired: item.job_required_experience || "",
      }));
    } catch (error) {
      lastError = error;
      const transientError = error?.code === "ECONNABORTED" || error?.response?.status === 429 || error?.response?.status >= 500 || error?.message?.toLowerCase().includes("timeout");

      console.warn(`[JSearch] attempt ${attempt}/3 failed: ${error?.message || "unknown error"}`);

      if (!transientError || attempt === 3) {
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          throw new Error("RapidAPI key is invalid or blocked. Check RAPIDAPI_KEY.");
        }

        return [];
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  if (lastError) {
    console.warn("[JSearch] all attempts failed; returning empty result set.");
  }

  return [];
}

async function discoverJobs({ query, location, jobType, isRemote, page = 1 }) {
  return searchJSearch({ query, location, jobType, isRemote, page });
}

module.exports = { discoverJobs, searchJSearch };
