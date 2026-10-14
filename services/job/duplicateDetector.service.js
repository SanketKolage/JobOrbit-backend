const Job = require("../../models/Job");

async function findDuplicate(source, sourceJobId, userId) {
  if (!source || !sourceJobId) return null;
  const query = { source, sourceJobId };
  if (userId) query.userId = userId;
  return Job.findOne(query);
}

async function upsertUniqueJobs(jobs = [], userId) {
  const saved = [];

  for (const job of jobs) {
    if (!job?.source || !job?.sourceJobId) continue;

    const normalizedJob = {
      ...job,
      ...(userId ? { userId } : {}),
    };

    const existing = await findDuplicate(job.source, job.sourceJobId, userId);
    if (existing) {
      Object.assign(existing, normalizedJob);
      await existing.save();
      saved.push(existing);
      continue;
    }

    const created = new Job(normalizedJob);
    await created.save();
    saved.push(created);
  }

  return saved;
}

module.exports = { findDuplicate, upsertUniqueJobs };
