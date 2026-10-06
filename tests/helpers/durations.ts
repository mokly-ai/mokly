import { performance } from "node:perf_hooks";

/** Start an observation and expose its duration only as text. */
export function startDuration(): () => string {
  const started = performance.now();
  return () => `${(performance.now() - started).toFixed(1)} ms`;
}

/** Report once on success or failure; return the result and preserve the callback's error. */
export async function reportDuration<T>(
  label: string,
  report: (text: string) => void,
  callback: () => T | PromiseLike<T>,
): Promise<T> {
  const duration = startDuration();
  let result: T;
  try {
    result = await callback();
  } catch (error) {
    try {
      report(`${label}: ${duration()}`);
    } catch {
      throw error;
    }
    throw error;
  }
  report(`${label}: ${duration()}`);
  return result;
}
