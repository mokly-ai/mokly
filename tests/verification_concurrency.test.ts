import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import browserConfig from "../playwright.config.js";
import {
  BROWSER_WORKERS_VARIABLE,
  browserWorkerCount,
  playwrightSuiteEnvironment,
  UNIT_CONCURRENCY_VARIABLE,
  unitTestConcurrency,
} from "../scripts/verification/concurrency.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

test("unit files and hydration workers default to half the CPUs", () => {
  for (const [cpus, unit, hydration] of [
    [1, 2, "1"],
    [2, 2, "1"],
    [3, 2, "1"],
    [4, 2, "2"],
    [7, 3, "3"],
    [8, 4, "4"],
    [16, 8, "8"],
  ] as const) {
    assert.equal(unitTestConcurrency({}, cpus), unit, `unit on ${cpus} CPUs`);
    assert.equal(
      playwrightSuiteEnvironment("hydration", {}, cpus)[
        BROWSER_WORKERS_VARIABLE
      ],
      hydration,
      `hydration on ${cpus} CPUs`,
    );
  }
});

test("browser specs default to one worker on every machine", () => {
  assert.equal(browserWorkerCount({}), 1);
  const environment = playwrightSuiteEnvironment(
    "browser",
    { PATH: "/bin" },
    64,
  );
  assert.deepEqual(environment, { PATH: "/bin" });
  assert.equal(browserWorkerCount(environment), 1);
});

test("each override replaces only its own default", () => {
  const env = {
    [UNIT_CONCURRENCY_VARIABLE]: "6",
    [BROWSER_WORKERS_VARIABLE]: "3",
  };
  assert.equal(unitTestConcurrency(env, 2), 6);
  assert.equal(browserWorkerCount(env), 3);
  assert.equal(
    playwrightSuiteEnvironment("hydration", env, 64)[BROWSER_WORKERS_VARIABLE],
    "3",
  );
  assert.equal(unitTestConcurrency({ [BROWSER_WORKERS_VARIABLE]: "1" }, 8), 4);
  assert.equal(browserWorkerCount({ [UNIT_CONCURRENCY_VARIABLE]: "5" }), 1);
});

test("the suite environment copies the caller's environment", () => {
  const env = { PATH: "/bin" };
  const environment = playwrightSuiteEnvironment("hydration", env, 8);
  assert.deepEqual(env, { PATH: "/bin" });
  assert.deepEqual(environment, {
    PATH: "/bin",
    [BROWSER_WORKERS_VARIABLE]: "4",
  });
});

test("overrides reject values that are not positive integers", () => {
  for (const value of [
    "",
    "0",
    "-1",
    "+4",
    "1.5",
    "1e3",
    "0x4",
    "04",
    " 4",
    "4 ",
    "four",
    "9007199254740992",
  ]) {
    assert.throws(
      () => unitTestConcurrency({ [UNIT_CONCURRENCY_VARIABLE]: value }, 8),
      {
        message: `MOKLY_UNIT_CONCURRENCY must be a positive integer; received ${value}`,
      },
    );
    assert.throws(
      () => browserWorkerCount({ [BROWSER_WORKERS_VARIABLE]: value }),
      {
        message: `MOKLY_PLAYWRIGHT_WORKERS must be a positive integer; received ${value}`,
      },
    );
  }
});

test("Playwright and both runners use the shared defaults", async () => {
  assert.equal(browserConfig.workers, browserWorkerCount());
  assert.equal(browserConfig.fullyParallel, false);
  const runner = (file: string) =>
    fs.readFile(
      path.join(repositoryRoot, "scripts/verification", file),
      "utf8",
    );
  const [unitRunner, unitExecution, selectedRunner, browserRunner] =
    await Promise.all([
      runner("unit-runner.mjs"),
      runner("unit-execution.mjs"),
      runner("unit-selected-run.mjs"),
      runner("run-browser.mjs"),
    ]);
  for (const source of [unitRunner, selectedRunner]) {
    assert.match(source, /const concurrency = unitTestConcurrency\(\);/u);
    assert.equal(source.match(/unitTestConcurrency\(\)/gu)?.length, 1);
    assert.match(source, /executeUnitTests\([\s\S]*?concurrency,/u);
    assert.doesNotMatch(source, /--test-concurrency=\d/u);
  }
  assert.match(
    unitExecution,
    /`--test-concurrency=\$\{options\.concurrency\}`/u,
  );
  assert.doesNotMatch(unitExecution, /--test-concurrency=\d/u);
  assert.match(
    browserRunner,
    /const environment = playwrightSuiteEnvironment\(suite\);/u,
  );
  assert.match(browserRunner, /env: \{ \.\.\.environment,/u);
});

test("Playwright assertions allow at least ten seconds", () => {
  const timeout = browserConfig.expect?.timeout;
  assert.equal(typeof timeout, "number");
  assert.ok(timeout !== undefined && timeout >= 10_000);
});

test("hydration route tests run in parallel with one bundle per worker", async () => {
  const spec = await fs.readFile(
    path.join(
      repositoryRoot,
      "tests/browser/react_shell_hydration_routes.spec.ts",
    ),
    "utf8",
  );
  assert.match(spec, /test\.describe\.configure\(\{ mode: "parallel" \}\);/u);
  assert.match(spec, /\{ scope: "worker", timeout: 120_000 \}/u);
  assert.doesNotMatch(
    spec,
    /beforeAll/u,
    "parallel mode reruns beforeAll for every test; build the bundle in a worker fixture",
  );
});
