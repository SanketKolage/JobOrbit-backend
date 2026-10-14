const test = require('node:test');
const assert = require('node:assert/strict');

const { getConfiguredProviders, isQuotaError } = require('../services/aiService');

test('getConfiguredProviders respects provider order from AI_PROVIDERS', () => {
  const originalProviders = process.env.AI_PROVIDERS;
  const originalOpenAI = process.env.OPENAI_API_KEY;
  const originalClaude = process.env.ANTHROPIC_API_KEY;
  const originalOpenRouter = process.env.OPENROUTER_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;

  process.env.AI_PROVIDERS = 'claude,openai,openrouter';
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.ANTHROPIC_API_KEY = 'claude-key';
  process.env.OPENROUTER_API_KEY = 'openrouter-key';
  process.env.GEMINI_API_KEY = '';

  try {
    assert.deepEqual(getConfiguredProviders(), ['claude', 'openai', 'openrouter']);
  } finally {
    if (originalProviders === undefined) delete process.env.AI_PROVIDERS;
    else process.env.AI_PROVIDERS = originalProviders;

    if (originalOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAI;

    if (originalClaude === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalClaude;

    if (originalOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouter;

    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
  }
});

test('isQuotaError detects quota and rate-limit failures', () => {
  assert.equal(isQuotaError({ message: '429 Too Many Requests' }), true);
  assert.equal(isQuotaError({ message: 'insufficient_quota' }), true);
  assert.equal(isQuotaError({ message: 'Authentication failed' }), false);
});

test('buildJobMatchAnalysis handles array requirements and descriptions', () => {
  const { buildJobMatchAnalysis } = require('../services/job/jobMatcher.service');

  const result = buildJobMatchAnalysis(
    {
      skills: ['javascript', 'node'],
      totalYearsExperience: 4,
      location: 'Remote',
      education: ['B.Tech'],
    },
    {
      title: 'Senior Developer',
      location: 'Remote',
      requirements: ['javascript', 'node', 'react', 'bachelor degree'],
      description: 'Build APIs and work with teams',
      isRemote: true,
    }
  );

  assert.ok(result.score >= 0);
  assert.ok(Array.isArray(result.matchedSkills));
  assert.ok(Array.isArray(result.missingSkills));
});
