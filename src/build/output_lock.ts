/** Repository writer lock that serializes generated-output transactions across processes. */
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { MOKLY_CACHE } from "../config/cache_paths.js";
import { projectRealPath } from "../config/paths.js";
import { timeAsync } from "../diagnostics/timings.js";
import { errorMessage, isMoklyError, MoklyError } from "../errors.js";

import {
  isAbandoned,
  publishLock,
  readLockHolder,
  reclaimLock,
  removeLock,
  type LockHolder,
} from "./output_lock_file.js";

/** Interval between ownership attempts while another writer holds the lock. */
const OUTPUT_LOCK_POLL_MS = 50;
/** Longest wait before a writer reports the holder instead of writing. */
const OUTPUT_LOCK_TIMEOUT_MS = 120_000;

/** Handles that still own their lock, mapped to their acquisition token. */
const activeLocks = new WeakMap<OutputLock, string>();

/** Waiting limits and cancellation for one acquisition. */
export interface OutputLockOptions {
  readonly signal?: AbortSignal;
  readonly pollMs?: number;
  readonly timeoutMs?: number;
}

/** Exclusive ownership of one repository's generated output until released. */
export interface OutputLock {
  readonly path: string;
  /** Remove the lock once; a failed removal is reclaimed by the next writer. */
  release(): Promise<void>;
}

/** Lock file shared by every spelling of the same repository root. */
export function outputLockPath(repoRoot: string): string {
  return path.join(
    projectRealPath(repoRoot),
    MOKLY_CACHE,
    "locks",
    "generated-output.lock",
  );
}

/** Run `action` while this process exclusively owns the repository's generated output. */
export async function withOutputLock<Result>(
  repoRoot: string,
  options: OutputLockOptions,
  action: (lock: OutputLock) => Promise<Result>,
): Promise<Result> {
  const lock = await acquireOutputLock(repoRoot, options);
  try {
    return await action(lock);
  } finally {
    await lock.release();
  }
}

/** Fail unless `lock` is still held for the repository at `repoRoot`. */
export function assertOutputLockHeld(lock: OutputLock, repoRoot: string): void {
  if (!activeLocks.has(lock) || lock.path !== outputLockPath(repoRoot))
    throw new Error(`generated output requires its writer lock: ${repoRoot}`);
}

/** Wait for exclusive ownership, reclaiming a lock whose holder stopped. */
export function acquireOutputLock(
  repoRoot: string,
  options: OutputLockOptions = {},
): Promise<OutputLock> {
  return timeAsync("output.lock", () =>
    acquire(outputLockPath(repoRoot), options),
  );
}

async function acquire(
  file: string,
  options: OutputLockOptions,
): Promise<OutputLock> {
  const timeoutMs = options.timeoutMs ?? OUTPUT_LOCK_TIMEOUT_MS;
  const pollMs = options.pollMs ?? OUTPUT_LOCK_POLL_MS;
  const started = Date.now();
  try {
    for (;;) {
      if (options.signal?.aborted) throw cancelled(file);
      const token = await publishLock(file);
      if (token) return held(file, token);
      const holder = await readLockHolder(file);
      if (holder && isAbandoned(holder) && (await reclaimLock(file, holder)))
        continue;
      const waited = Date.now() - started;
      if (waited >= timeoutMs) throw timedOut(file, holder, timeoutMs);
      try {
        await delay(
          Math.min(pollMs, timeoutMs - waited),
          undefined,
          options.signal ? { signal: options.signal } : undefined,
        );
      } catch {
        throw cancelled(file);
      }
    }
  } catch (error) {
    if (isMoklyError(error)) throw error;
    throw new MoklyError(
      "build-invalid",
      `could not lock generated output at ${file}: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}

function held(file: string, token: string): OutputLock {
  const lock: OutputLock = {
    path: file,
    release: async () => {
      if (activeLocks.get(lock) !== token) return;
      activeLocks.delete(lock);
      await removeLock(file, token);
    },
  };
  activeLocks.set(lock, token);
  return lock;
}

function cancelled(file: string): MoklyError {
  return new MoklyError(
    "build-invalid",
    `cancelled while waiting for the generated-output lock at ${file}`,
    { cancelled: true },
  );
}

function timedOut(
  file: string,
  holder: LockHolder | undefined,
  timeoutMs: number,
): MoklyError {
  const owner =
    holder?.pid === undefined
      ? "Another process"
      : `Another Mokly process (pid ${holder.pid})`;
  return new MoklyError(
    "build-invalid",
    `${owner} is still writing generated output after ${Number((timeoutMs / 1000).toFixed(1))} s. If no Mokly command is running, delete ${file} and retry.`,
  );
}
