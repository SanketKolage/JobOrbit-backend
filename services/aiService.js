const { GoogleGenAI } = require("@google/genai");
const Anthropic = require("@anthropic-ai/sdk");
const { buildJobMatchAnalysis } = require("./job/jobMatcher.service");
const { analyzeJobDescription } = require("./ai/jdAnalyzer.service");
const { buildTailoredResume } = require("./ai/resumeTailor.service");
const { buildCoverLetterText } = require("./ai/coverLetter.service");
const { buildAnswer, isPersonalOrLegalQuestion } = require("./ai/applicationAnswer.service");

let geminiClient = null;

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

function getConfiguredProviders() {
  const configured = {
    openrouter: !!process.env.OPENROUTER_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };

  const preferredOrder = (process.env.AI_PROVIDERS || "openrouter,openai,claude,gemini")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);

  const validProviders = preferredOrder.filter((provider) => configured[provider]);
  const remainingProviders = Object.keys(configured)
    .filter((provider) => configured[provider] && !validProviders.includes(provider));

  return [...validProviders, ...remainingProviders];
}

function isQuotaError(error) {
  const errorText = [
    error?.message,
    error?.status,
    error?.code,
    error?.response?.status,
    error?.response?.data?.error?.message,
    error?.response?.data?.message,
    JSON.stringify(error?.response?.data || {})
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(429|rate[_ -]?limit|quota|insufficient_quota|too many requests|billing|limit reached|exceeded)/i.test(errorText);
}

function isTransientError(error) {
  const errorText = [
    error?.message,
    error?.status,
    error?.code,
    JSON.stringify(error?.response?.data || {})
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(429|408|500|502|503|504|timeout|timed out|temporar|rate[_ -]?limit|too many requests|unavailable|connection reset|network)/i.test(errorText);
}

function getProviderModel(provider) {
  const configMap = {
    openrouter: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
    claude: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
    gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  };

  return configMap[provider] || "gpt-4o-mini";
}

function getErrorMessage(error) {
  if (!error) return "Unknown AI provider error";
  if (error.response?.data?.error?.message) return error.response.data.error.message;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return JSON.stringify(error);
}

async function callGemini(prompt, { jsonMode = false } = {}) {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("Gemini API key is missing");
  }

  const response = await client.models.generateContent({
    model: getProviderModel("gemini"),
    contents: prompt,
    config: jsonMode ? { responseMimeType: "application/json" } : {},
  });

  return response.text;
}

async function callOpenAICompatible(provider, prompt, { jsonMode = false } = {}) {
  const apiKey = provider === "openrouter"
    ? process.env.OPENROUTER_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(`${provider} API key is missing`);
  }

  const endpoint = provider === "openrouter"
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const body = {
    model: getProviderModel(provider),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "openrouter" && {
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
        "X-Title": "Auto Job Applier",
      }),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.response = { data };
    throw error;
  }

  return data.choices?.[0]?.message?.content || "";
}

async function callClaude(prompt, { jsonMode = false } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key is missing");
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: getProviderModel("claude"),
    max_tokens: 2000,
    system: jsonMode ? "Return valid JSON only." : "Return concise, structured output.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = (response.content || [])
    .map((part) => (typeof part === "string" ? part : part?.text || ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Claude returned empty response");
  }

  return text;
}

async function callProvider(prompt, { jsonMode = false } = {}) {
  const providers = getConfiguredProviders();
  if (!providers.length) {
    throw new Error("No AI provider configured. Add OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.");
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      switch (provider) {
        case "openrouter":
          return await callOpenAICompatible("openrouter", prompt, { jsonMode });
        case "openai":
          return await callOpenAICompatible("openai", prompt, { jsonMode });
        case "claude":
          return await callClaude(prompt, { jsonMode });
        case "gemini":
          return await callGemini(prompt, { jsonMode });
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      lastError = error;
      const reason = getErrorMessage(error);
      const shouldRetry = isQuotaError(error) || isTransientError(error);

      console.warn(`[AI Provider] ${provider} failed: ${reason}`);

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw lastError || new Error("All configured AI providers failed");
}

async function generateJSON(prompt, retries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await callProvider(prompt, { jsonMode: true });
      return JSON.parse(raw);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isTransientError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Unable to generate valid JSON from AI provider");
}
async function generateTailoredResume(
  resumeParsed,
  jobDetails
) {
  const fallback = buildTailoredResume(resumeParsed, jobDetails);

  const prompt = `
You are an ATS optimization expert.

Rewrite the resume to maximize ATS score.

Rules:
- Never invent skills or experience.
- Never invent projects or certifications.
- Only use information present in the candidate profile and job description.
- Reorder skills based on JD relevance.
- Rewrite summary and bullets for ATS clarity.
- Return ONLY valid JSON.

{
  "summary": "",
  "skills": [],
  "experience": [],
  "projects": [],
  "atsScore": 0,
  "matchAnalysis": {
    "summary": "",
    "suggestedSummary": "",
    "relevantSkills": [],
    "relevantExperienceBullets": [],
    "relevantProjects": [],
    "missingRequirements": [],
    "atsRecommendations": []
  }
}

Resume:
${JSON.stringify(resumeParsed)}

Job:
${JSON.stringify(jobDetails)}
`;

  try {
    const aiResult = await generateJSON(prompt);
    return {
      ...fallback,
      ...aiResult,
      summary: aiResult.summary || fallback.summary,
      skills: Array.isArray(aiResult.skills) && aiResult.skills.length ? aiResult.skills : fallback.skills,
      experience: Array.isArray(aiResult.experience) && aiResult.experience.length ? aiResult.experience : fallback.experience,
      projects: Array.isArray(aiResult.projects) && aiResult.projects.length ? aiResult.projects : fallback.projects,
      atsScore: typeof aiResult.atsScore === "number" ? aiResult.atsScore : 85,
      matchAnalysis: aiResult.matchAnalysis || fallback.matchAnalysis,
    };
  } catch (error) {
    return fallback;
  }
}
// ─────────────────────────────────────────────────────────────
// Generic Text Generator
// ─────────────────────────────────────────────────────────────
async function generateText(prompt) {
  const responseText = await callProvider(prompt, { jsonMode: false });
  return responseText.trim();
}

// ─────────────────────────────────────────────────────────────
// 1. Parse Resume
// ─────────────────────────────────────────────────────────────
async function parseResume(rawText) {
  const prompt = `
You are an expert resume parser.

Extract structured information from the resume below.

Return ONLY valid JSON.

seniorityLevel MUST be exactly one of:

Junior
Mid
Senior
Lead
Principal
Executive

Do not return values like:
Junior Developer
Senior Engineer
Lead Developer

{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedIn": "",
  "github": "",
  "portfolio": "",
  "summary": "",
  "skills": [],
  "techStack": [],
  "experience": [],
  "education": [],
  "certifications": [],
  "languages": [],
  "totalYearsExperience": 0,
  "seniorityLevel": "",
  "targetRoles": [],
  "industryFocus": []
}

Resume:
${rawText}
`;

  return await generateJSON(prompt);
}

// ─────────────────────────────────────────────────────────────
// 2. Score Job Match
// ─────────────────────────────────────────────────────────────
async function scoreJobMatch(resumeParsed, jobDetails) {
  const fallbackMatch = buildJobMatchAnalysis(resumeParsed, jobDetails);

  try {
    const prompt = `
You are an ATS and recruiter expert.

Evaluate how well the candidate matches the job.

Rules:
- Only use real evidence from the candidate profile and job data.
- Do not invent skills, experience, or education.
- Return ONLY valid JSON.
- Keep explanations truthful.

{
  "score": 0,
  "strengths": [],
  "gaps": [],
  "recommendation": "",
  "shouldApply": true,
  "explanation": ""
}

Candidate:
${JSON.stringify(resumeParsed, null, 2)}

Job:
${JSON.stringify(jobDetails, null, 2)}
`;

    const aiResult = await generateJSON(prompt);
    return {
      ...fallbackMatch,
      ...aiResult,
      score: typeof aiResult.score === "number" ? aiResult.score : fallbackMatch.score,
      strengths: Array.isArray(aiResult.strengths) && aiResult.strengths.length ? aiResult.strengths : fallbackMatch.strengths,
      gaps: Array.isArray(aiResult.gaps) && aiResult.gaps.length ? aiResult.gaps : fallbackMatch.gaps,
      recommendation: aiResult.recommendation || fallbackMatch.recommendation,
      shouldApply: typeof aiResult.shouldApply === "boolean" ? aiResult.shouldApply : fallbackMatch.shouldApply,
      explanation: aiResult.explanation || fallbackMatch.explanation,
      overallMatchScore: typeof aiResult.score === "number" ? aiResult.score : fallbackMatch.overallMatchScore,
      skillMatchScore: fallbackMatch.skillMatchScore,
      experienceMatchScore: fallbackMatch.experienceMatchScore,
      locationMatchScore: fallbackMatch.locationMatchScore,
      titleMatchScore: fallbackMatch.titleMatchScore,
      educationMatchScore: fallbackMatch.educationMatchScore,
      preferenceMatchScore: fallbackMatch.preferenceMatchScore,
    };
  } catch (error) {
    return fallbackMatch;
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Cover Letter
// ─────────────────────────────────────────────────────────────
async function generateCoverLetter(resumeParsed, jobDetails, options = {}) {
  const tone = options.tone || "Professional";
  const fallback = buildCoverLetterText(resumeParsed, jobDetails, tone);

  const prompt = `
Write a concise, truthful cover letter.

Requirements:
- 3 to 4 paragraphs
- Tone: ${tone}
- Mention the company and role
- Only use facts from the candidate profile and job description
- Do not invent experience, projects, or certifications
- End with a clear call to action
- No markdown

Candidate:
${JSON.stringify(resumeParsed, null, 2)}

Job:
${JSON.stringify(jobDetails, null, 2)}
`;

  try {
    const generated = await generateText(prompt);
    if (generated && generated.length > 20) return generated;
    return fallback;
  } catch (error) {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Resume Tailoring Suggestions
// ─────────────────────────────────────────────────────────────
async function generateTailoringSuggestions(
  resumeParsed,
  jobDetails
) {
  const fallback = buildTailoredResume(resumeParsed, jobDetails);
  const jdAnalysis = analyzeJobDescription(resumeParsed, jobDetails);

  const prompt = `
You are an ATS optimization expert.

Return ONLY valid JSON.

{
  "suggestions": [],
  "keywordsToAdd": [],
  "keywordsPresent": [],
  "atsScore": 0,
  "priorityActions": [],
  "matchAnalysis": {
    "summary": "",
    "suggestedSummary": "",
    "relevantSkills": [],
    "relevantExperienceBullets": [],
    "relevantProjects": [],
    "missingRequirements": [],
    "atsRecommendations": []
  }
}

Candidate:
${JSON.stringify(resumeParsed, null, 2)}

Job:
${JSON.stringify(jobDetails, null, 2)}
`;

  try {
    const aiResult = await generateJSON(prompt);
    return {
      ...fallback,
      ...aiResult,
      suggestions: Array.isArray(aiResult.suggestions) && aiResult.suggestions.length ? aiResult.suggestions : [
        `Emphasize ${jdAnalysis.requiredSkills.slice(0, 4).join(", ") || "core role skills"} in the summary and experience section.`,
        `Use the exact job keywords where they align with your real experience.`,
      ],
      keywordsToAdd: Array.isArray(aiResult.keywordsToAdd) && aiResult.keywordsToAdd.length ? aiResult.keywordsToAdd : jdAnalysis.missingRequirements.slice(0, 5),
      keywordsPresent: Array.isArray(aiResult.keywordsPresent) && aiResult.keywordsPresent.length ? aiResult.keywordsPresent : jdAnalysis.keywordsPresent.slice(0, 5),
      atsScore: typeof aiResult.atsScore === "number" ? aiResult.atsScore : 85,
      priorityActions: Array.isArray(aiResult.priorityActions) && aiResult.priorityActions.length ? aiResult.priorityActions : [
        "Rewrite the summary using the JD keywords that match your background.",
        "Highlight the most relevant technologies in the skills and experience section.",
      ],
      matchAnalysis: aiResult.matchAnalysis || fallback.matchAnalysis,
    };
  } catch (error) {
    return {
      ...fallback,
      suggestions: [
        `Emphasize ${jdAnalysis.requiredSkills.slice(0, 4).join(", ") || "core role skills"} in the summary and experience section.`,
        `Use the exact job keywords where they align with your real experience.`,
      ],
      keywordsToAdd: jdAnalysis.missingRequirements.slice(0, 5),
      keywordsPresent: jdAnalysis.keywordsPresent.slice(0, 5),
      atsScore: 85,
      priorityActions: [
        "Rewrite the summary using the JD keywords that match your background.",
        "Highlight the most relevant technologies in the skills and experience section.",
      ],
      matchAnalysis: fallback.matchAnalysis,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Application Email
// ─────────────────────────────────────────────────────────────
async function generateApplicationEmail(
  resumeParsed,
  jobDetails
) {
  const prompt = `
Write a job application email.

Return ONLY valid JSON.

{
  "subject": "",
  "intro": ""
}

Candidate Name:
${resumeParsed.name}

Job Title:
${jobDetails.title}

Company:
${jobDetails.company}
`;

  return await generateJSON(prompt);
}

// ─────────────────────────────────────────────────────────────
// 6. Batch Score Jobs
// ─────────────────────────────────────────────────────────────
async function batchScoreJobs(resumeParsed, jobs) {
  const results = [];

  for (const job of jobs) {
    try {
      const match = await scoreJobMatch(
        resumeParsed,
        job
      );

      results.push({
        jobId: job._id,
        ...match,
      });
    } catch (err) {
      console.error(
        `Error scoring job ${job._id}:`,
        err.message
      );

      results.push({
        jobId: job._id,
        score: 0,
        strengths: [],
        gaps: ["Failed to score this job"],
        recommendation: "Unable to evaluate",
        shouldApply: false,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────
async function generateApplicationAnswers(resumeParsed, questions = []) {
  if (!Array.isArray(questions) || !questions.length) {
    return [];
  }

  return questions.map((question) => {
    const answer = buildAnswer(resumeParsed, question);
    return {
      question,
      answer: answer.answer,
      requiresUserInput: answer.requiresUserInput || isPersonalOrLegalQuestion(question),
    };
  });
}

module.exports = {
  getConfiguredProviders,
  isQuotaError,
  parseResume,
  scoreJobMatch,
  generateCoverLetter,
  generateTailoringSuggestions,
  generateApplicationEmail,
  batchScoreJobs,
  generateTailoredResume,
  generateApplicationAnswers,
};