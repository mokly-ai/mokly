/** Track complete child-output lines and report stalled large builds. */
import fs from "node:fs/promises";
import path from "node:path";

export interface LivenessTimer {
  schedule(callback: () => void, delayMs: number): () => void;
}

const systemTimer: LivenessTimer = {
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

/** Restart a liveness window whenever a complete output line arrives. */
export function outputLiveness(
  windowMs: number,
  expired: () => void,
  timer: LivenessTimer = systemTimer,
) {
  let active = true;
  const expire = () => {
    if (!active) return;
    active = false;
    expired();
  };
  let cancel = timer.schedule(expire, windowMs);
  return {
    line() {
      if (!active) return;
      cancel();
      cancel = timer.schedule(expire, windowMs);
    },
    finish() {
      if (!active) return;
      active = false;
      cancel();
    },
  };
}

/** Notify once for each newline, including lines split across child chunks. */
export function completeLineObserver(onLine: () => void) {
  return (chunk: string | Uint8Array) => {
    for (const byte of chunk) if (byte === 10 || byte === "\n") onLine();
  };
}

/** Preserve the liveness failure when graceful shutdown escalates. */
export function buildLiveness(
  running: { done: Promise<void> },
  root: string,
  windowMs: number,
  shutdown: () => Promise<void>,
  timer?: LivenessTimer,
) {
  let expired = false;
  const watch = outputLiveness(
    windowMs,
    () => {
      expired = true;
      void shutdown().catch(() => {});
    },
    timer,
  );
  return {
    ...watch,
    get expired() {
      return expired;
    },
    async wait() {
      try {
        await running.done;
      } catch (error) {
        if (!expired) throw error;
      } finally {
        watch.finish();
      }
      if (expired) throw new Error(await buildLivenessMessage(root, windowMs));
    },
  };
}

const reservationSuffix = [
  ".mokly-export-reservations",
  "locks",
  "mokly-static",
];

export function reservationPath(root: string) {
  return path.join(root, ...reservationSuffix);
}

async function pathExists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Explain a stalled build and preserve the required manual lock recovery. */
export async function buildLivenessMessage(
  root: string,
  windowMs: number,
  exists: (file: string) => Promise<boolean> = pathExists,
) {
  const lock = reservationPath(root);
  const seconds = windowMs / 1_000;
  const message = `Build wrote no output line for ${seconds} seconds, the harness liveness limit.`;
  return (await exists(lock))
    ? `${message} Inspect ${lock} and remove it before the next build.`
    : message;
}
