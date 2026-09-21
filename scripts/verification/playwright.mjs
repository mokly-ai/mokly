import path from "node:path";

import { runCaptured } from "./process.mjs";

export async function discoverBrowserTests(repositoryRoot, shard) {
  const cli = path.join(repositoryRoot, "node_modules/@playwright/test/cli.js");
  const args = [cli, "test", "--list", "--reporter=json"];
  if (shard) args.push(`--shard=${shard.index}/${shard.total}`);
  const result = await runCaptured(process.execPath, args, {
    cwd: repositoryRoot,
  });
  if (result.exitCode !== 0 || result.signal !== null)
    throw new Error(
      `Playwright discovery failed (${result.signal ?? result.exitCode})\n${result.stderr}`,
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
    files: [...new Set(tests.map((test) => test.file))].sort(),
    tests: tests.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function playwrightTests(report, repositoryRoot) {
  const tests = [];
  const testRoot = path.resolve(report.config?.rootDir ?? repositoryRoot);
  for (const suite of report.suites ?? [])
    visitSuite(suite, [], tests, repositoryRoot, testRoot);
  if (new Set(tests.map((test) => test.id)).size !== tests.length)
    throw new Error("Playwright discovery returned duplicate test IDs");
  return tests;
}

function visitSuite(suite, titles, tests, repositoryRoot, testRoot) {
  const nextTitles = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const file = relativeFile(
        repositoryRoot,
        testRoot,
        spec.file ?? suite.file,
      );
      if (!spec.id || !test.projectName || !file)
        throw new Error(
          "Playwright discovery returned an incomplete test identity",
        );
      tests.push({
        id: `${test.projectName}:${spec.id}`,
        project: test.projectName,
        file,
        line: spec.line,
        column: spec.column,
        title: [...nextTitles, spec.title].filter(Boolean).join(" › "),
      });
    }
  }
  for (const child of suite.suites ?? [])
    visitSuite(child, nextTitles, tests, repositoryRoot, testRoot);
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
