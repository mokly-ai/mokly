export interface CiTimingRun {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  fetch: typeof globalThis.fetch;
  write: { stdout: (text: string) => void };
}

/** Write the timing summary and annotations; resolve to the exit status. */
export function runCiTiming(run: CiTimingRun): Promise<0 | 1>;
