import type { GitHubRequest } from "./ci-timing-jobs.mjs";

/** The IDs of the newest green CI runs of pushes to `main`, newest first. */
export function greenMainRuns(
  request: GitHubRequest,
  count: number,
): Promise<string[]>;

/** The newest run whose App checks shards all passed, or null. */
export function completeAppRun(
  request: GitHubRequest,
  runIds: readonly string[],
): Promise<{ runId: string; jobIds: number[] } | null>;
