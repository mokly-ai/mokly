import { startDuration } from "./durations.js";

/** Fixture setup is bounded separately from a browser assertion. */
export const FULL_CATALOGUE_SETUP_TIMEOUT_MS = 600_000;

/** Isolated catalogue setup is bounded separately from its browser tests. */
export const ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS = 180_000;

/** Emit an observation on both success and failure; no duration decides a result. */
export async function timeFixturePhase<T>(
  fixture: string,
  phase: string,
  operationUnderTest: boolean,
  operation: () => Promise<T>,
): Promise<T> {
  const duration = startDuration();
  let status = "error";
  try {
    const result = await operation();
    status = "ok";
    return result;
  } finally {
    process.stderr.write(
      `[mokly:fixture-timing] ${JSON.stringify({ schemaVersion: 1, fixture, phase, operationUnderTest, status, durationMs: Number.parseFloat(duration()) })}\n`,
    );
  }
}
