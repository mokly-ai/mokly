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

export function ciReports(
  runtimes: readonly string[] = ["node-22.14.0", "node-24"],
): VerificationReportFixture[] {
  return runtimes.flatMap((runtime): VerificationReportFixture[] => {
    const files = [
      "tests/tooling.test.ts",
      "packages/viewer/tests/viewer.test.tsx",
    ];
    const viewer: VerificationReportFixture = {
      schemaVersion: 1,
      suite: "viewer",
      commit: "a".repeat(40),
      runtime,
      nodeVersion: runtime === "node-22.14.0" ? "22.14.0" : "24.21.0",
      shard: null,
      fullFiles: files,
      assignedFiles: files,
      observedFiles: files.map((file) => ({ file, durationMs: 1, tests: 1 })),
      failures: [],
      reporterComplete: true,
      reporterErrors: [],
      skipped: 0,
      cancelled: 0,
      outcome: { exitCode: 0, signal: null, status: "passed" },
    };
    const tests = Array.from({ length: 8 }, (_, index) => ({
      id: `chromium:test-${index}`,
      project: "chromium",
      specFile: `tests/browser/test-${index}.spec.ts`,
      file: `tests/browser/test-${index}.spec.ts`,
      line: 1,
      column: 1,
      title: `test ${index}`,
    }));
    const browser = Array.from(
      { length: 4 },
      (_, offset): VerificationReportFixture => {
        const assigned = tests.slice(offset * 2, offset * 2 + 2);
        const files = assigned.map((test) => test.specFile);
        return {
          ...viewer,
          suite: "browser",
          shard: { index: offset + 1, total: 4 },
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
            errors: [],
          })),
        };
      },
    );
    return [viewer, ...browser];
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
