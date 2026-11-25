import assert from "node:assert/strict";
import test from "node:test";

import {
  compileSeconds,
  logTests,
  testHost,
  testSeconds,
} from "../scripts/verification/rust-test-weights.mjs";

test("a job log lists each passed test with its unit and seconds", () => {
  const log = [
    "2026-11-25T19:55:26.7284850Z         PASS [   0.250s] (   1/2076) mokly-catalogue config::reads",
    "2026-11-25T19:55:26.7482530Z         PASS [   2.000s] (   3/2076) mokly-cli::bin/mokly args::parse",
    "2026-11-25T19:55:26.7724410Z         PASS [   0.750s] mokly-render::integration_tests plan::drops",
    "2026-11-25T19:55:27.0000000Z      Summary [  53.519s] 3 tests run: 3 passed, 0 skipped",
  ].join("\n");
  assert.deepEqual(logTests(log), [
    { unit: "--lib", test: "mokly-catalogue config::reads", seconds: 0.25 },
    {
      unit: "--bin mokly",
      test: "mokly-cli::bin/mokly args::parse",
      seconds: 2,
    },
    {
      unit: "--test integration_tests",
      test: "mokly-render::integration_tests plan::drops",
      seconds: 0.75,
    },
  ]);
});

test("only Repository and native jobs name a test host", () => {
  assert.deepEqual(
    [
      "Repository (shard 3/5)",
      "Native (macos-26, shard 2/6)",
      "Native (windows-2025, shard 7/7)",
      "Browser (Node 22.15.0, shard 1/14)",
    ].map(testHost),
    ["linux", "macos", "windows", null],
  );
});

test("test seconds take each test's median run, sum a unit's tests, then take the mean host", () => {
  const sample = (
    run: string,
    host: string,
    test: string,
    seconds: number,
  ) => ({
    run,
    host,
    unit: "--test cli",
    test,
    seconds,
  });
  assert.deepEqual(
    testSeconds([
      // Run 3 lacks the slice that holds test b, so b has two samples.
      sample("1", "windows", "a", 10),
      sample("1", "windows", "b", 20),
      sample("2", "windows", "a", 30),
      sample("2", "windows", "b", 40),
      sample("3", "windows", "a", 100),
      sample("1", "linux", "a", 4),
      sample("1", "linux", "b", 6),
    ]),
    // Windows: a median 30, b median 30, sum 60. Linux: 10. Mean 35.
    { "--test cli": 35 },
  );
});

test("compile seconds take the test builds of a timing report times 1.5", () => {
  const units = [
    { name: "mokly-graph", target: ' mokly_graph "lib" (test)', duration: 10 },
    { name: "mokly-html", target: ' mokly_html "lib" (test)', duration: 6 },
    { name: "mokly-cli", target: ' mokly "bin" (test)', duration: 4 },
    { name: "mokly-cli", target: ' cli "test" (test)', duration: 2 },
    { name: "mokly-cli", target: ' mokly_cli "lib"', duration: 30 },
    { name: "mokly-cli", target: ' mokly_cli "lib" (doc test)', duration: 0 },
  ];
  const html = `<script>\nconst UNIT_DATA = ${JSON.stringify(units)};\nconst CONCURRENCY_DATA = [];\n</script>`;
  assert.deepEqual(compileSeconds(html), {
    "--bin mokly": 6,
    "--lib": 24,
    "--test cli": 3,
  });
  // A report of a warm build lists no test build and replaces nothing.
  assert.throws(
    () => compileSeconds("const UNIT_DATA = [];\n"),
    /built no test target/u,
  );
});
