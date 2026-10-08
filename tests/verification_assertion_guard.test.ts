/** Verify assertion accounting through real Node test-runner evidence. */
import assert from "node:assert/strict";
import test from "node:test";

import { guardFixture } from "./helpers/assertion_guard.js";

test("the guard rejects empty tests, subtests, and describe/it leaves", async (context) => {
  const result = await guardFixture(context, "basic");
  assert.equal(result.report.reporterComplete, true);
  assert.equal(result.exitCode, 1);
  for (const [name, fullName] of [
    ["empty", "empty"],
    ["empty child", "parent with empty child > empty child"],
    ["empty it", "suite > empty it"],
  ] as const) {
    const failure = result.report.failures.find(
      (failure) => failure.name === name,
    );
    assert.ok(failure, name);
    assert.ok(
      failure.diagnostic.includes(`test made no assertions: ${fullName}`),
    );
  }
  for (const name of [
    "one assertion",
    "child assertion",
    "parent with assertion in child",
    "assertion",
  ])
    assert.equal(
      result.report.failures.some((failure) => failure.name === name),
      false,
      name,
    );
});

test("skip and todo exemptions leave later tests valid", async (context) => {
  const result = await guardFixture(context, "exemptions");
  assert.equal(result.exitCode, 0);
  for (const failure of result.report.failures)
    assert.equal(failure.name, "todo option");
  assert.equal(result.report.summaries[0]?.counts.skipped, 2);
  assert.equal(result.report.summaries[0]?.counts.todo, 2);
});

test("all import forms and context assertions count without changing comparison behavior", async (context) => {
  const result = await guardFixture(context, "assertions");
  assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  assert.deepEqual(result.report.failures, []);
  assert.equal(result.report.summaries[0]?.counts.passed, 11);
});

test("beforeEach assertions count", async (context) => {
  const result = await guardFixture(context, "before");
  assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  assert.deepEqual(result.report.failures, []);
});

test("afterEach and context cleanup assertions do not count", async (context) => {
  const result = await guardFixture(context, "after");
  assert.equal(result.exitCode, 1);
  for (const name of ["afterEach only", "context after only"])
    assert.ok(
      result.report.failures
        .find((failure) => failure.name === name)
        ?.diagnostic.includes(`test made no assertions: ${name}`),
    );
});

test("concurrent siblings fail with the sequential diagnostic", async (context) => {
  const result = await guardFixture(context, "concurrent");
  assert.equal(result.exitCode, 1);
  assert.match(
    result.stdout,
    /assertion guard needs sequential tests: concurrent parent > first sibling is still running/,
  );
});

for (const scenario of [
  "method",
  "named",
  "direct",
  "ok",
  "rejects",
] as const) {
  test(`${scenario}: failure diagnostics retain the native message and fixture caller`, async (context) => {
    const baseline = await guardFixture(
      context,
      "diagnostics",
      false,
      scenario,
      scenario !== "ok",
    );
    const guarded = await guardFixture(
      context,
      "diagnostics",
      true,
      scenario,
      scenario !== "ok",
    );
    assert.equal(baseline.exitCode, 1);
    assert.equal(guarded.exitCode, 1);
    const original = baseline.report.failures[0]?.diagnostic;
    const actual = guarded.report.failures[0]?.diagnostic;
    assert.ok(original);
    assert.ok(actual);
    assert.equal(
      actual.split("\nCaused by:")[0],
      original.split("\nCaused by:")[0],
    );
    const originalLine = /\n\s+at[^\n]*diagnostics\.mjs:(\d+):(\d+)/u.exec(
      original,
    );
    const actualLine = /\n\s+at[^\n]*diagnostics\.mjs:(\d+):(\d+)/u.exec(
      actual,
    );
    assert.ok(originalLine);
    assert.ok(actualLine);
    assert.equal(actualLine[1], originalLine[1]);
    const cause = actual.split("\nCaused by:")[1] ?? actual;
    const firstFrame = cause.split("\n").find((line) => /^\s+at /u.test(line));
    assert.ok(
      firstFrame?.includes("diagnostics.mjs"),
      firstFrame ?? "missing frame",
    );
    if (scenario === "ok") assert.match(actual, /assert\.ok\(5 < 3\)/u);
    if (scenario === "rejects")
      assert.match(actual, /Missing expected rejection/u);
  });
}

test("forked children retain stdout and exit code with inherited imports", async (context) => {
  const result = await guardFixture(context, "fork");
  assert.equal(result.exitCode, 0, result.stdout + result.stderr);
  assert.deepEqual(result.report.failures, []);
});
