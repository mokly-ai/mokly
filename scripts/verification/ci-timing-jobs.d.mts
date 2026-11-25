/** One step of a job with a start and a completion time. */
export interface TimedStep {
  name: string;
  seconds: number;
}

/** The latest execution of one job of a workflow run. */
export interface TimedJob {
  id: number;
  name: string;
  attempt: number;
  status: string;
  conclusion: string | null;
  createdMs: number;
  startedMs: number | null;
  completedMs: number | null;
  url: string | null;
  /** True when an earlier attempt ran the job and this attempt reused it. */
  reused: boolean;
  steps: TimedStep[];
}

export interface GitHubRequest {
  fetch: typeof globalThis.fetch;
  apiUrl: string;
  repository: string;
  token: string;
}

export interface RunJobsRequest extends GitHubRequest {
  runId: string;
}

export function fetchRunJobs(request: RunJobsRequest): Promise<unknown[]>;

export function githubJson(
  request: Pick<GitHubRequest, "fetch" | "apiUrl" | "token">,
  path: string,
): Promise<unknown>;

export function parseJobs(entries: readonly unknown[]): {
  jobs: TimedJob[];
  issues: string[];
};

export function spanSeconds(
  startMs: number | null,
  endMs: number | null,
): number | null;

export function jobSeconds(job: TimedJob): number | null;
