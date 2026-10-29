/** Track complete child-output lines and report stalled large builds. */
import fs from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

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
  let cancel = timer.schedule(expired, windowMs);
  return {
    line() {
      if (!active) return;
      cancel();
      cancel = timer.schedule(expired, windowMs);
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
  const decoder = new StringDecoder("utf8");
  let partial = "";
  return (chunk: string | Uint8Array) => {
    const text =
      partial +
      (typeof chunk === "string" ? chunk : decoder.write(Buffer.from(chunk)));
    const lines = text.split("\n");
    partial = lines.pop() ?? "";
    for (const _line of lines) onLine();
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
