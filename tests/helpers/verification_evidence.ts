export function unitReport(
  index: number,
  assignedFiles: string[],
  fullFiles = assignedFiles,
) {
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

export function browserTest(id: string, file: string) {
  return {
    id,
    project: "chromium",
    file,
    line: 1,
    column: 1,
    title: `test ${id}`,
  };
}

export function ciReports() {
  return ["node-22.14.0", "node-24.21.0"].flatMap((runtime) =>
    ["unit", "browser"].flatMap((suite) => {
      const files = [1, 2, 3, 4].map(
        (index) =>
          `tests/${suite}/shard-${index}.${suite === "unit" ? "test" : "spec"}.ts`,
      );
      const tests = files.map((file, index) =>
        browserTest(`${runtime}-${index}`, file),
      );
      return files.map((file, index) => ({
        ...unitReport(index + 1, [file], files),
        runtime,
        nodeVersion: runtime === "node-22.14.0" ? "22.14.0" : "24.21.0",
        suite,
        fullTests: suite === "browser" ? tests : [],
        assignedTests: suite === "browser" ? [tests[index]!] : [],
        observedTests:
          suite === "browser"
            ? [
                {
                  ...tests[index]!,
                  durationMs: 1,
                  status: "passed",
                  errors: [],
                },
              ]
            : [],
      }));
    }),
  );
}
