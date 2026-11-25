import assert from "node:assert/strict";
import test from "node:test";

import {
  compileSeconds,
  logUnitSeconds,
  testHost,
  testSeconds,
} from "../scripts/verification/rust-test-weights.mjs";

test("a job log sums the nextest seconds of each library, binary, and test unit", () => {
  const log = [
    "2026-11-25T19:55:26.7284850Z         PASS [   0.250s] (   1/2076) mokly-catalogue config::reads",
    "2026-11-25T19:55:26.7378520Z         PASS [   1.500s] (   2/2076) mokly-graph walk::orders",
    "2026-11-25T19:55:26.7482530Z         PASS [   2.000s] (   3/2076) mokly-cli::bin/mokly args::parse",
    "2026-11-25T19:55:26.7587120Z         PASS [  10.250s] (   4/2076) mokly-render::integration_tests plan::reuses",
    "2026-11-25T19:55:26.7724410Z         PASS [   0.750s] mokly-render::integration_tests plan::drops",
    "2026-11-25T19:55:27.0000000Z      Summary [  53.519s] 4 tests run: 4 passed, 0 skipped",
  ].join("\n");
  assert.deepEqual(Object.fromEntries(logUnitSeconds(log)), {
    "--lib": 1.75,
    "--bin mokly": 2,
    "--test integration_tests": 11,
  });
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

test("test seconds sum the shards of a run, take the median run, then the mean host", () => {
  const sample = (run: string, host: string, seconds: number) => ({
    run,
    host,
    unit: "--test cli",
    seconds,
  });
  assert.deepEqual(
    testSeconds([
      // Two Windows slices of one run add up to 30.
      sample("1", "windows", 10),
      sample("1", "windows", 20),
      sample("2", "windows", 50),
      sample("3", "windows", 100),
      sample("1", "linux", 9),
      sample("2", "linux", 11),
    ]),
    // Windows median 50 (mean 60), Linux median 10, mean 30.
    { "--test cli": 30 },
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
});
