import { existsSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Playwright runs from this package's root, which the npm scripts guarantee.
const packageRoot = process.cwd();
export const repositoryRoot = resolve(packageRoot, "../..");
export const runtimeDirectory = resolve(packageRoot, ".expo/app-tests");

/** Where the running API writes its log, including the development mail links. */
export const apiLogPath = resolve(runtimeDirectory, "api.log");

/** Where the running catalogue server writes its log, beside the API's. */
export const catalogueLogPath = resolve(runtimeDirectory, "catalogue.log");

/** Why the suite cannot run at all, as opposed to why it failed. */
export interface StartOutcome {
  /** Set only when the environment cannot host the suite; the run skips aloud. */
  skip?: string;
  /** Set when the suite could have run but did not; the run fails. */
  failure?: string;
}

/**
 * Open a fresh log for one server this run starts, and forget the pid an
 * earlier run recorded for it. The log's directory is created here, so a
 * server that starts before the others never depends on their order. The
 * previous log is cleared at start rather than at teardown, so a failed suite
 * leaves its diagnostics behind.
 */
export function openServerLog(logPath: string, pidPath: string): number {
  mkdirSync(dirname(logPath), { recursive: true });
  rmSync(logPath, { force: true });
  rmSync(pidPath, { force: true });
  return openSync(logPath, "a");
}

/** Stop exactly the process this run recorded, and nothing found by name. */
export function stopRecorded(path: string): void {
  const pid = existsSync(path) ? Number(readFileSync(path, "utf8").trim()) : 0;
  rmSync(path, { force: true });
  if (!Number.isFinite(pid) || pid <= 0) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }
}
