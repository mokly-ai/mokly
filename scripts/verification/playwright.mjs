import path from "node:path";

import { runCaptured } from "./process.mjs";

export async function discoverBrowserTests(repositoryRoot, options = {}) {
  const { project, shard } = options;
  const cli = path.join(repositoryRoot, "node_modules/@playwright/test/cli.js");
  const args = [cli, "test", "--list", "--reporter=json"];
  if (project) args.push(`--project=${project}`);
  if (shard) args.push(`--shard=${shard.index}/${shard.total}`);
  const result = await runCaptured(process.execPath, args, {
    cwd: repositoryRoot,
  });
  if (result.exitCode !== 0 || result.signal !== null)
    throw new Error(
      [
        `Playwright discovery failed (${result.signal ?? result.exitCode})`,
        ...reportedErrors(result.stdout),
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error("Playwright discovery did not return JSON", {
      cause: error,
    });
  }
  if (report.errors?.length)
    throw new Error(
      `Playwright discovery reported errors:\n${report.errors.map((entry) => entry.message).join("\n")}`,
    );
  const tests = playwrightTests(report, repositoryRoot);
  if (tests.length === 0)
    throw new Error("Playwright test discovery was empty");
  return {
    files: [...new Set(tests.map((test) => test.specFile))].sort(),
    tests: tests.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

/** Sum observed test durations and counts per spec file, sorted by file. */
export function summarizeObservedFiles(tests) {
  const files = new Map();
  for (const test of tests) {
    const entry = files.get(test.specFile) ?? {
      file: test.specFile,
      durationMs: 0,
      tests: 0,
    };
    entry.durationMs += test.durationMs;
    entry.tests += 1;
    files.set(test.specFile, entry);
  }
  return [...files.values()].sort((left, right) =>
    left.file.localeCompare(right.file),
  );
}

/** Return the load errors a failed JSON list run reported, if its output parses. */
function reportedErrors(stdout) {
  try {
    return (JSON.parse(stdout).errors ?? []).map((entry) => entry.message);
  } catch {
    return [];
  }
}

function playwrightTests(report, repositoryRoot) {
  const tests = [];
  const testRoot = path.resolve(report.config?.rootDir ?? repositoryRoot);
  for (const suite of report.suites ?? [])
    visitSuite(suite, [], tests, {
      repositoryRoot,
      testRoot,
      specFile: relativeFile(repositoryRoot, testRoot, suite.file),
    });
  if (new Set(tests.map((test) => test.id)).size !== tests.length)
    throw new Error("Playwright discovery returned duplicate test IDs");
  return tests;
}

/**
 * Collect the tests of one top-level file suite. `source.specFile` is the spec
 * that Playwright loaded; `file` is where the test is defined, which can be a
 * helper module that the spec imports.
 */
function visitSuite(suite, titles, tests, source) {
  const nextTitles = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const file = relativeFile(
        source.repositoryRoot,
        source.testRoot,
        spec.file ?? suite.file,
      );
      if (!spec.id || !test.projectName || !file || !source.specFile)
        throw new Error(
          "Playwright discovery returned an incomplete test identity",
        );
      tests.push({
        id: `${test.projectName}:${spec.id}`,
        project: test.projectName,
        specFile: source.specFile,
        file,
        line: spec.line,
        column: spec.column,
        title: [...nextTitles, spec.title].filter(Boolean).join(" › "),
      });
    }
  }
  for (const child of suite.suites ?? [])
    visitSuite(child, nextTitles, tests, source);
}

function relativeFile(repositoryRoot, testRoot, file) {
  if (!file) return undefined;
  const relative = path.relative(repositoryRoot, path.resolve(testRoot, file));
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(
      `Playwright reported a test outside the repository: ${file}`,
    );
  return relative.split(path.sep).join("/");
}
