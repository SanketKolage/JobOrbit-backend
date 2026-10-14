const test = require('node:test');
const assert = require('node:assert/strict');

const { retrieveRelevantContext } = require('../services/ragService');
const { generateInterviewPrep, evaluateMockAnswer } = require('../services/interviewService');

test('RAG retrieval ranks highly relevant documents first', () => {
  const docs = [
    { id: '1', title: 'General note', content: 'The team uses Kubernetes and Node.js for deployment.' },
    { id: '2', title: 'Hiring brief', content: 'We are looking for a React engineer with strong TypeScript and product thinking.' },
    { id: '3', title: 'Resume note', content: 'Candidate has deep frontend experience with React and TypeScript.' },
  ];

  const results = retrieveRelevantContext(docs, 'React TypeScript frontend engineer', 3);
  assert.equal(results[0].id, '3');
  assert.ok(results[0].score >= results[1].score);
});

test('Interview prep creates role-aligned questions', () => {
  const prep = generateInterviewPrep(
    {
      title: 'Senior Frontend Engineer',
      skills: ['React', 'TypeScript', 'Testing'],
      requirements: ['Build user-facing features', 'Ship resilient frontends'],
      responsibilities: ['Design systems', 'Lead code reviews'],
    },
    {
      summary: 'Frontend engineer with React and TypeScript experience',
      skills: ['React', 'TypeScript', 'Testing'],
      experience: ['Built dashboards and component libraries'],
    }
  );

  assert.ok(Array.isArray(prep.questions));
  assert.ok(prep.questions.length >= 4);
  assert.match(prep.summary, /Senior Frontend Engineer|target role/i);
});

test('Mock answer evaluator returns feedback and a score range', () => {
  const result = evaluateMockAnswer(
    'Describe how you build scalable product features.',
    'I build user-facing features in React and TypeScript, validate them with testing, and monitor adoption to improve the product over time.',
    { skills: ['React', 'TypeScript', 'Testing'] }
  );

  assert.ok(Number.isInteger(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(Array.isArray(result.strengths));
  assert.ok(Array.isArray(result.gaps));
});
