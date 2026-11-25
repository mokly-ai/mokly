import type { CiShardTotals } from "../../scripts/verification/aggregate.mjs";
import ciShards from "../../scripts/verification/ci-shards.json" with { type: "json" };

export interface VerificationReportFixture {
  schemaVersion: number;
  suite: string;
  commit: string;
  runtime: string;
  nodeVersion: string;
  shard: null | { index: number; total: number };
  playwrightFiles?: string[];
  fullTests?: BrowserTest[];
  assignedTests?: BrowserTest[];
  observedTests?: (BrowserTest & {
    status: string;
    durationMs: number;
    wallMs?: number;
    errors: unknown[];
  })[];
  fullFiles: string[];
  assignedFiles: string[];
  observedFiles: { file: string; durationMs: number; tests: number }[];
  failures: unknown[];
  reporterComplete: boolean;
  reporterErrors: unknown[];
  skipped: number;
  cancelled: number;
  outcome: { exitCode: number; signal: null; status: string };
}

/**
 * Passed reports of every viewer and browser shard per runtime. Each viewer
 * shard holds two files and each browser shard holds two tests.
 */
export function ciReports(
  runtimes: readonly string[] = ["node-22.15.0", "node-24"],
  totals: Readonly<CiShardTotals> = ciShards,
): VerificationReportFixture[] {
  return runtimes.flatMap((runtime): VerificationReportFixture[] => {
    const files = Array.from(
      { length: totals.viewer * 2 },
      (_, index) => `tests/tooling-${index}.test.ts`,
    );
    const viewer: VerificationReportFixture[] = Array.from(
      { length: totals.viewer },
      (_, offset) => {
        const assigned = files.slice(offset * 2, offset * 2 + 2);
        return {
          schemaVersion: 1,
          suite: "viewer",
          commit: "a".repeat(40),
          runtime,
          nodeVersion: runtime === "node-22.15.0" ? "22.15.0" : "24.21.0",
          shard: { index: offset + 1, total: totals.viewer },
          fullFiles: files,
          assignedFiles: assigned,
          observedFiles: assigned.map((file) => ({
            file,
            durationMs: 1,
            tests: 1,
          })),
          failures: [],
          reporterComplete: true,
          reporterErrors: [],
          skipped: 0,
          cancelled: 0,
          outcome: { exitCode: 0, signal: null, status: "passed" },
        };
      },
    );
    const tests = Array.from({ length: totals.browser * 2 }, (_, index) => ({
      id: `chromium:test-${index}`,
      project: "chromium",
      specFile: `tests/browser/test-${index}.spec.ts`,
      file: `tests/browser/test-${index}.spec.ts`,
      line: 1,
      column: 1,
      title: `test ${index}`,
    }));
    const browser = Array.from(
      { length: totals.browser },
      (_, offset): VerificationReportFixture => {
        const assigned = tests.slice(offset * 2, offset * 2 + 2);
        const files = assigned.map((test) => test.specFile);
        return {
          ...viewer[0]!,
          suite: "browser",
          shard: { index: offset + 1, total: totals.browser },
          playwrightFiles: tests.map((test) => test.specFile),
          fullFiles: tests.map((test) => test.specFile),
          assignedFiles: files,
          observedFiles: files.map((file) => ({
            file,
            durationMs: 1,
            tests: 1,
          })),
          fullTests: tests,
          assignedTests: assigned,
          observedTests: assigned.map((test) => ({
            ...test,
            status: "passed",
            durationMs: 1,
            wallMs: 1,
            errors: [],
          })),
        };
      },
    );
    return [...viewer, ...browser];
  });
}

export interface BrowserTest {
  id: string;
  project: string;
  specFile: string;
  file: string;
  line: number;
  column: number;
  title: string;
}
