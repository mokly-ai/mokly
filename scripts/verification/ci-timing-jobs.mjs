const PAGE_SIZE = 100;
const PAGE_LIMIT = 10;

/**
 * Read the latest execution of every job of one workflow run, page by page.
 * `filter=latest` lists each job once. After a rerun of failed jobs, it lists
 * the jobs that did not rerun under the new attempt with their old times.
 */
export async function fetchRunJobs({
  fetch,
  apiUrl,
  repository,
  runId,
  token,
}) {
  const entries = [];
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const path = `/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=${PAGE_SIZE}&page=${page}`;
    const response = await fetch(`${apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mokly-ci-timing",
      },
    });
    if (!response.ok)
      throw new Error(
        `GitHub GET ${path} failed (${response.status}); the job needs actions: read`,
      );
    const body = await response.json();
    const jobs = isRecord(body) && Array.isArray(body.jobs) ? body.jobs : null;
    if (!jobs) throw new Error(`GitHub GET ${path} returned no jobs array`);
    entries.push(...jobs);
    const total = typeof body.total_count === "number" ? body.total_count : 0;
    if (jobs.length < PAGE_SIZE || entries.length >= total) break;
  }
  return entries;
}

/**
 * Narrow raw API job entries to timed jobs. An entry without a name, an id,
 * or a valid creation time is left out and named in `issues`.
 */
export function parseJobs(entries) {
  const jobs = [];
  const issues = [];
  for (const [index, entry] of entries.entries()) {
    const job = parseJob(entry);
    if (job) jobs.push(job);
    else issues.push(`job entry ${index} has no id, name, or creation time`);
  }
  return { jobs, issues };
}

function parseJob(entry) {
  if (!isRecord(entry)) return null;
  const createdMs = time(entry.created_at);
  if (
    typeof entry.id !== "number" ||
    typeof entry.name !== "string" ||
    createdMs === null
  )
    return null;
  const startedMs = time(entry.started_at);
  const completedMs = time(entry.completed_at);
  const attempt = typeof entry.run_attempt === "number" ? entry.run_attempt : 1;
  const conclusion =
    typeof entry.conclusion === "string" ? entry.conclusion : null;
  return {
    id: entry.id,
    name: entry.name,
    attempt,
    status: typeof entry.status === "string" ? entry.status : "unknown",
    conclusion,
    createdMs,
    startedMs,
    completedMs,
    url: typeof entry.html_url === "string" ? entry.html_url : null,
    // A job that an earlier attempt ran keeps its old completion time, which
    // comes before its creation in the current attempt. A skipped job can
    // also complete before its creation, so it never counts as reused.
    reused:
      attempt > 1 &&
      conclusion !== "skipped" &&
      completedMs !== null &&
      completedMs < createdMs,
    steps: Array.isArray(entry.steps) ? entry.steps.flatMap(parseStep) : [],
  };
}

function parseStep(entry) {
  if (!isRecord(entry) || typeof entry.name !== "string") return [];
  const seconds = spanSeconds(time(entry.started_at), time(entry.completed_at));
  return seconds === null ? [] : [{ name: entry.name, seconds }];
}

/** Whole seconds from `startMs` to `endMs`, or null when either is missing. */
export function spanSeconds(startMs, endMs) {
  if (startMs === null || endMs === null) return null;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

/** Run time of a job that started and completed, or null. */
export function jobSeconds(job) {
  return job.status === "completed"
    ? spanSeconds(job.startedMs, job.completedMs)
    : null;
}

function time(value) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
