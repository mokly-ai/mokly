import { spanSeconds } from "./ci-timing-jobs.mjs";

/**
 * Find the chain of jobs that set the wall clock of the current attempt.
 *
 * The API gives no job graph. GitHub creates a job when its last needed job
 * completes, so the blocking job of each job is the job that completed last
 * at or before that creation time. The chain starts at the job that completed
 * last and walks back. Only jobs that ran in the current attempt take part:
 * a job reused from an earlier attempt keeps its old times. A skipped job
 * never blocks another job on the path.
 */
export function criticalPath(jobs) {
  const ran = jobs.filter(
    (job) =>
      !job.reused &&
      job.status === "completed" &&
      job.startedMs !== null &&
      job.completedMs !== null,
  );
  const reused = jobs.filter((job) => job.reused).length;
  if (ran.length === 0) return null;
  const startMs = Math.min(...ran.map((job) => job.createdMs));
  const blockers = ran.filter((job) => job.conclusion !== "skipped");
  const last = latest(blockers.length > 0 ? blockers : ran);
  const chain = [];
  const seen = new Set();
  for (let job = last; job && !seen.has(job.id); job = blocker(job, blockers)) {
    seen.add(job.id);
    chain.unshift(job);
  }
  let previousEndMs = startMs;
  const segments = chain.map((job) => {
    const segment = {
      job,
      waitSeconds: spanSeconds(previousEndMs, job.startedMs),
      runSeconds: spanSeconds(job.startedMs, job.completedMs),
      endSeconds: spanSeconds(startMs, job.completedMs),
    };
    previousEndMs = job.completedMs;
    return segment;
  });
  return {
    startMs,
    endMs: last.completedMs,
    wallSeconds: spanSeconds(startMs, last.completedMs),
    ranJobs: blockers.length,
    reusedJobs: reused,
    segments,
  };
}

function blocker(job, candidates) {
  return latest(
    candidates.filter(
      (candidate) =>
        candidate.id !== job.id && candidate.completedMs <= job.createdMs,
    ),
  );
}

/**
 * The job that completed last. Times have whole-second precision, so on a tie
 * the job created later wins: a job that waited for its own needs is more
 * likely to be on the path than a job that started with the run.
 */
function latest(jobs) {
  return jobs.reduce(
    (found, job) => (found === null || later(job, found) ? job : found),
    null,
  );
}

function later(job, other) {
  if (job.completedMs !== other.completedMs)
    return job.completedMs > other.completedMs;
  if (job.createdMs !== other.createdMs) return job.createdMs > other.createdMs;
  return job.startedMs < other.startedMs;
}
