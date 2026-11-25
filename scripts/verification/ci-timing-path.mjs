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
    ranJobs: ran.length,
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

function latest(jobs) {
  return jobs.reduce(
    (found, job) =>
      found === null ||
      job.completedMs > found.completedMs ||
      (job.completedMs === found.completedMs && job.startedMs < found.startedMs)
        ? job
        : found,
    null,
  );
}
