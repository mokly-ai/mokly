import {
  LOCK_POLL_MS,
  LOCK_TIMEOUT_MS,
  type CacheLayout,
} from "./cache_layout.js";
import { assertBaselineActive, BaselineError } from "./errors.js";
import type {
  BaselineClock,
  BaselineFileSystem,
  BaselineProcessRunner,
} from "./types.js";

/** An acquired entry lock remains held across extraction, adoption and marker publication. */
export interface BaselineLock {
  release(): Promise<void>;
}

export async function tryBaselineLock(
  fs: BaselineFileSystem,
  runner: BaselineProcessRunner,
  clock: BaselineClock,
  layout: CacheLayout,
): Promise<BaselineLock | undefined> {
  const bytes = Buffer.from(
    JSON.stringify({ pid: runner.pid, startedAt: clock.now() }),
  );
  const ownership = await fs.acquireLock(layout.lock, bytes);
  if (!ownership) return;
  return {
    async release() {
      if ((await fs.stat(layout.lock))?.identity === ownership.identity)
        await fs.remove(layout.lock);
    },
  };
}

export async function acquireBaselineLock(
  fs: BaselineFileSystem,
  runner: BaselineProcessRunner,
  clock: BaselineClock,
  layout: CacheLayout,
  signal?: AbortSignal,
  timeoutMs = LOCK_TIMEOUT_MS,
): Promise<BaselineLock> {
  const startedAt = clock.now();
  while (true) {
    assertBaselineActive(signal);
    const lock = await tryBaselineLock(fs, runner, clock, layout);
    if (lock) return lock;
    const stat = await fs.stat(layout.lock);
    if (stat) {
      if (stat.kind !== "regular")
        throw new BaselineError(
          "baseline-output-invalid",
          "Baseline lock is not a regular file",
        );
      let owner: { pid?: unknown };
      try {
        owner = JSON.parse(
          Buffer.from(await fs.read(layout.lock, 4096)).toString("utf8"),
        ) as { pid?: unknown };
      } catch {
        owner = {};
      }
      if (
        owner &&
        typeof owner.pid === "number" &&
        Number.isSafeInteger(owner.pid) &&
        owner.pid > 0 &&
        !runner.isAlive(owner.pid)
      ) {
        if (await fs.reclaimLock(layout.lock, stat.identity)) continue;
      }
    }
    if (clock.now() - startedAt >= timeoutMs)
      throw new BaselineError(
        "baseline-lock-timeout",
        `Timed out waiting for baseline ${layout.entry}`,
      );
    await clock.sleep(
      Math.min(LOCK_POLL_MS, timeoutMs - (clock.now() - startedAt)),
      signal,
    );
  }
}
