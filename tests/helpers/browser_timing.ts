import { performance } from "node:perf_hooks";

import { reportFixtureTiming } from "./fixture_timing.js";

const STARTED_AT = "MOKLY_BROWSER_SUITE_STARTED_AT";

/** Config loading starts this clock without creating any fixture during discovery. */
export function startBrowserSuiteTimer(): void {
  process.env[STARTED_AT] = String(performance.timeOrigin + performance.now());
}

/** Include server startup and global setup, not only the duration of test assertions. */
export function reportBrowserStartup(): void {
  const started = Number(process.env[STARTED_AT]);
  if (!Number.isFinite(started))
    throw new Error("Browser startup timing was not initialized");
  reportFixtureTiming({
    schemaVersion: 1,
    fixture: "browser-suite",
    phase: "startup",
    operationUnderTest: false,
    durationMs:
      Math.round((performance.timeOrigin + performance.now() - started) * 100) /
      100,
    status: "ok",
  });
}
