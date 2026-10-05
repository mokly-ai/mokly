const value = process.env["MOKLY_TEST_TIME_SCALE"];
const scale = value === undefined ? 1 : Number(value);
if (
  value !== undefined &&
  (!/^\d+(?:\.\d+)?$/u.test(value) || !Number.isFinite(scale) || scale < 1)
) {
  throw new Error(
    `MOKLY_TEST_TIME_SCALE must be a decimal of at least 1; received ${JSON.stringify(value)}`,
  );
}

/** Scale fixture preparation and measured readiness limits for the current run. */
export function scaledTimeLimit(baseMs: number): number {
  return Math.ceil(baseMs * scale);
}
