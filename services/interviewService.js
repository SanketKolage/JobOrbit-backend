function normalizeWords(input = []) {
  return (Array.isArray(input) ? input : [input])
    .flatMap((item) => String(item || "").split(/[\s,|/]+/))
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
}

function buildKeywordList(job = {}, resumeParsed = {}) {
  const jobKeywords = normalizeWords([
    job.skills,
    job.requirements,
    job.responsibilities,
    job.title,
    job.description,
  ]);

  const profileKeywords = normalizeWords([
    resumeParsed.skills,
    resumeParsed.techStack,
    resumeParsed.targetRoles,
    resumeParsed.summary,
    resumeParsed.experience,
  ]);

  return {
    jobKeywords: [...new Set(jobKeywords)].slice(0, 18),
    profileKeywords: [...new Set(profileKeywords)].slice(0, 18),
  };
}

function generateInterviewPrep(job = {}, resumeParsed = {}) {
  const { jobKeywords, profileKeywords } = buildKeywordList(job, resumeParsed);
  const experience = Array.isArray(resumeParsed.experience) ? resumeParsed.experience : [];
  const topSkill = jobKeywords[0] || "core role skills";

  const questions = [
    {
      question: `Walk me through your experience with ${topSkill} and how it relates to this ${job.title || "role"} position.`,
      whyAsk: "The interviewer wants to confirm the candidate can map their background to the required technical and business scope.",
      expectedConcepts: jobKeywords.slice(0, 5),
      guidance: "Tie your answer to concrete work, project outcomes, and the specific responsibilities listed in the job description.",
    },
    {
      question: `Describe a project or task where you used ${jobKeywords[1] || "the most relevant technical stack"} in a production environment.`,
      whyAsk: "This checks applied experience, trade-offs, and role clarity.",
      expectedConcepts: jobKeywords.slice(0, 6),
      guidance: "Highlight architecture decisions, constraints, tools used, and how you validated the solution.",
    },
    {
      question: `How would you approach the main responsibilities of this role when starting on day one?`,
      whyAsk: "Interviewers want to know whether the candidate can turn requirements into a practical execution plan.",
      expectedConcepts: ["planning", "execution", "prioritization", "communication"],
      guidance: "Outline a structured plan, dependencies, validation steps, and communication rhythm.",
    },
    {
      question: `Tell me about the most complex problem you solved and how you measured success.`,
      whyAsk: "This reveals ownership, problem solving, and the ability to communicate outcomes clearly.",
      expectedConcepts: ["root cause", "trade-offs", "measurement", "improvement"],
      guidance: "Use a concise STAR structure and focus on measurable impact, not just technical details.",
    },
    {
      question: `What are the biggest skill gaps between your current background and this role, and how would you close them?`,
      whyAsk: "This checks honesty, self-awareness, and whether the candidate can honestly assess the role fit.",
      expectedConcepts: profileKeywords.slice(0, 5),
      guidance: "Be truthful about what you are still learning and describe a realistic plan for ramp-up.",
    },
  ];

  if (experience.length) {
    questions.push({
      question: `Which experience from your resume is most relevant to this role, and why should we care?`,
      whyAsk: "The interviewer wants a focused explanation of the candidate's strongest proof points.",
      expectedConcepts: ["relevance", "ownership", "impact"],
      guidance: "Pick the most relevant role, describe the scope, and connect it directly to the job requirements.",
    });
  }

  return {
    summary: `Prepared a focused interview plan aligned to ${job.title || "the target role"}, covering core skills, work samples, and role-fit discussion points.`,
    questions,
  };
}

function evaluateMockAnswer(question = "", answer = "", job = {}) {
  const text = String(answer || "").toLowerCase();
  const keywords = normalizeWords([
    question,
    job.skills,
    job.requirements,
    job.responsibilities,
    job.description,
  ]);

  const keywordMatches = keywords.filter((keyword) => keyword.length > 3 && text.includes(keyword)).length;
  const lengthScore = Math.min(25, Math.max(0, Math.floor(text.length / 80)));
  const keywordScore = Math.min(40, Math.max(0, keywordMatches * 6));
  const structureScore = text.includes("because") || text.includes("for example") || text.includes("i worked") ? 20 : 10;
  const total = Math.min(100, Math.max(0, lengthScore + keywordScore + structureScore + 15));

  const strengths = [];
  const gaps = [];

  if (lengthScore >= 15) strengths.push("Provided a substantial, detailed response");
  else gaps.push("Add more concrete examples and more specific details");

  if (keywordMatches >= 3) strengths.push("Included relevant role keywords and context");
  else gaps.push("Connect your answer more directly to the job requirements");

  if (structureScore >= 18) strengths.push("Used a clear explanation structure");
  else gaps.push("Improve answer structure with a clearer beginning, middle, and end");

  return {
    score: Math.round(total),
    strengths,
    gaps,
    feedback: "Focus on specific examples, tie them to the role requirements, and explain the trade-offs and outcomes clearly.",
  };
}

module.exports = {
  generateInterviewPrep,
  evaluateMockAnswer,
};
