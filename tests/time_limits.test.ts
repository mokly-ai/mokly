import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { parseTestSource, testSources } from "./helpers/test_sources.js";
import { unscaledTimeLimits } from "./helpers/time_limit_rules.js";

test("time-limit guard rejects fixed setup and duration limits", () => {
  for (const source of [
    "assert.ok(elapsed < 2_500)",
    "assert.ok(2_500 > duration)",
    "expect(elapsed).toBeLessThanOrEqual(1000)",
    "test.beforeAll(async () => { test.setTimeout(120_000); })",
    "before(async () => {}, { timeout: 90_000 })",
    'const fixture = [prepare, {scope: "worker", timeout: 300_000}]',
    "const fixture = [prepare, {scope: 'worker', timeout: 300_000}]",
    "const fixture = [async () => {}, {timeout: 300_000}]",
    "const LIMIT = 300_000; before(prepare, {timeout: LIMIT})",
    "const timeout = 300_000; const fixture = [prepare, {scope: 'worker', timeout}]",
    "test.beforeAll(() => {const limit = 120_000; test.setTimeout(limit)}); test.beforeAll(() => {const limit = scaledTimeLimit(120_000); test.setTimeout(limit)})",
  ])
    assert.equal(
      unscaledTimeLimits([parseTestSource(source)]).length,
      1,
      source,
    );
});

test("time-limit guard accepts scaled limits, lower bounds, diagnostics and ordinary deadlines", () => {
  for (const source of [
    "assert.ok(elapsed < scaledTimeLimit(2500))",
    "const limit = scaledTimeLimit(120_000); test.beforeAll(() => { test.setTimeout(limit); })",
    "before(prepare, {timeout: scaledTimeLimit(90_000)})",
    'const fixture = [prepare, {scope: "worker", timeout: scaledTimeLimit(300_000)}]',
    "const fixture = [async () => {}, {timeout: scaledTimeLimit(300_000)}]",
    "const timeout = scaledTimeLimit(300_000); const fixture = [prepare, {scope: 'worker', timeout}]",
    "expect(elapsed).toBeLessThan(scaledTimeLimit(1000))",
    "assert.ok(elapsed >= 4_900)",
    "expect(duration).toBeGreaterThanOrEqual(4900)",
    "context.diagnostic(`collection: ${elapsed} ms`)",
    "assert.ok(start.elapsedMs <= event.elapsedMs)",
    "test('ordinary test', {timeout: 60_000}, () => {})",
    "test('ordinary test', () => { test.setTimeout(60_000); })",
    'expect(page.locator("h1")).toHaveText("Ready", { timeout: 15_000 })',
    'const sample = "assert.ok(elapsed < 2_500)"',
  ])
    assert.deepEqual(unscaledTimeLimits([parseTestSource(source)]), [], source);
});

test("time-limit guard follows imported scaled setup limits", () => {
  assert.deepEqual(
    unscaledTimeLimits([
      parseTestSource(
        "export const LIMIT = scaledTimeLimit(300_000)",
        path.resolve("limits.ts"),
      ),
      parseTestSource(
        'import { LIMIT as budget } from "./limits.js"; test.beforeAll(() => { test.setTimeout(budget); })',
        path.resolve("sample.ts"),
      ),
    ]),
    [],
  );
});

test("every fixture setup and duration upper bound follows the time-limit rule", () => {
  assert.deepEqual(unscaledTimeLimits(testSources()), []);
});

function loadHelper(scale: string | undefined, evaluate = true) {
  const env = { ...process.env };
  if (scale === undefined) delete env["MOKLY_TEST_TIME_SCALE"];
  else env["MOKLY_TEST_TIME_SCALE"] = scale;
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      'import {scaledTimeLimit} from "./tests/helpers/time_limits.ts"; ' +
        (evaluate
          ? "console.log(JSON.stringify([scaledTimeLimit(100), scaledTimeLimit(100.1)]))"
          : 'console.log("helper loaded")'),
    ],
    { cwd: repositoryRoot, env, encoding: "utf8" },
  );
}

test("scaledTimeLimit uses one by default and rounds decimal scales up", () => {
  for (const [scale, expected] of [
    [undefined, [100, 101]],
    ["1", [100, 101]],
    ["1.5", [150, 151]],
    ["3", [300, 301]],
    ["01.50", [150, 151]],
  ] as const) {
    const result = loadHelper(scale);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  }
});

test("an invalid scale fails when the helper loads and names the variable and value", () => {
  for (const scale of [
    "",
    "0",
    "0.9",
    "-1",
    "+1",
    "1e2",
    "0x10",
    " 2 ",
    "NaN",
    "Infinity",
    "one",
    "1.",
    "9".repeat(400),
  ]) {
    const result = loadHelper(scale, false);
    assert.notEqual(result.status, 0, scale);
    assert.ok(result.stderr.includes("MOKLY_TEST_TIME_SCALE"), result.stderr);
    assert.ok(result.stderr.includes(JSON.stringify(scale)), result.stderr);
    assert.equal(result.stdout, "");
  }
});

test("unit, browser and hydration execution pass the caller environment unchanged", () => {
  for (const filename of ["unit-runner.mjs", "run-browser.mjs"])
    assert.match(
      readFileSync(
        path.join(repositoryRoot, "scripts/verification", filename),
        "utf8",
      ),
      /env: \{ \.\.\.process\.env, MOKLY_(?:NODE|PLAYWRIGHT)_EVENT_REPORT:/u,
    );
});
