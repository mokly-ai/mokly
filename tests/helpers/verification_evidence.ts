export interface BrowserTestFixture {
  id: string;
  project: string;
  specFile: string;
  file: string;
  line: number;
  column: number;
  title: string;
}

export interface ObservedBrowserTest extends BrowserTestFixture {
  durationMs: number;
  status: string;
  errors: unknown[];
}

export interface VerificationReportFixture {
  schemaVersion: number;
  suite: string;
  commit: string;
  runtime: string;
  nodeVersion: string;
  shard: { index: number; total: number } | null;
  playwrightFiles?: string[];
  fullFiles: string[];
  assignedFiles: string[];
  observedFiles: Array<{ file: string; durationMs: number; tests: number }>;
  fullTests: BrowserTestFixture[];
  assignedTests: BrowserTestFixture[];
  observedTests: ObservedBrowserTest[];
  failures: unknown[];
  reporterComplete: boolean;
  reporterErrors: unknown[];
  skipped: number;
  cancelled: number;
  outcome: { exitCode: number; signal: null; status: string };
}

export function unitReport(
  index: number,
  assignedFiles: string[],
  fullFiles = assignedFiles,
): VerificationReportFixture {
  return {
    schemaVersion: 1,
    suite: "unit",
    commit: "a".repeat(40),
    runtime: "node-24.21.0",
    nodeVersion: "24.21.0",
    shard: { index, total: 4 },
    fullFiles,
    assignedFiles,
    observedFiles: assignedFiles.map((file) => ({
      file,
      durationMs: 1,
      tests: 1,
    })),
    fullTests: [],
    assignedTests: [],
    observedTests: [],
    failures: [],
    reporterComplete: true,
    reporterErrors: [],
    skipped: 0,
    cancelled: 0,
    outcome: { exitCode: 0, signal: null, status: "passed" },
  };
}

export function browserTest(
  id: string,
  file: string,
  project = "chromium",
): BrowserTestFixture {
  return {
    id,
    project,
    specFile: file,
    file,
    line: 1,
    column: 1,
    title: `test ${id}`,
  };
}

export function ciReports(
  runtimes: readonly string[] = ["node-22.14.0", "node-24"],
): VerificationReportFixture[] {
  return runtimes.flatMap((runtime) => {
    const nodeVersion = runtime === "node-22.14.0" ? "22.14.0" : "24.21.0";
    const unitFiles = [1, 2, 3, 4].map(
      (index) => `tests/unit/shard-${index}.test.ts`,
    );
    const browserFiles = [1, 2, 3, 4].map(
      (index) => `tests/browser/shard-${index}.spec.ts`,
    );
    const hydrationFiles = ["tests/browser/shell_hydration.spec.ts"];
    const playwrightFiles = [...browserFiles, ...hydrationFiles];
    const browserTests = browserFiles.map((file, index) =>
      browserTest(`${runtime}-browser-${index}`, file),
    );
    const hydrationTests = hydrationFiles.map((file, index) =>
      browserTest(`${runtime}-hydration-${index}`, file, "hydration"),
    );
    const unit = unitFiles.map((file, index) => ({
      ...unitReport(index + 1, [file], unitFiles),
      runtime,
      nodeVersion,
    }));
    const browser = browserFiles.map((file, index) => ({
      ...unitReport(index + 1, [file], browserFiles),
      runtime,
      nodeVersion,
      suite: "browser",
      playwrightFiles,
      fullTests: browserTests,
      assignedTests: [browserTests[index]!],
      observedTests: [passedTest(browserTests[index]!)],
    }));
    const hydration = {
      ...unitReport(1, hydrationFiles, hydrationFiles),
      runtime,
      nodeVersion,
      suite: "hydration",
      shard: null,
      playwrightFiles,
      fullTests: hydrationTests,
      assignedTests: hydrationTests,
      observedTests: hydrationTests.map(passedTest),
    };
    return [...unit, ...browser, hydration];
  });
}

function passedTest(test: BrowserTestFixture): ObservedBrowserTest {
  return { ...test, durationMs: 1, status: "passed", errors: [] };
}
