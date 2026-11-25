import assert from "node:assert/strict";
import test from "node:test";

import VerificationReporter from "../scripts/verification/playwright-reporter.mjs";
import { shardWeights } from "../scripts/verification/shard-weights.mjs";

import { ciReports } from "./helpers/verification_evidence.js";

const TOTALS = { viewer: 1, browser: 1 } as const;

/** One viewer and one browser report per sample; each browser spec has two tests. */
function reports(viewer: number[], browser: number[][]) {
  return viewer.map((duration, index) => {
    const [viewerReport, browserReport] = structuredClone(
      ciReports(["node-22.15.0"], TOTALS),
    );
    viewerReport!.observedFiles[0]!.durationMs = duration;
    browserReport!.observedTests!.forEach((entry, test) => {
      entry.specFile = "tests/browser/one.spec.ts";
      entry.wallMs = browser[index]?.[test] ?? 0;
    });
    return [viewerReport!, browserReport!];
  });
}

test("shard weights take the median per-test wall time and file duration", () => {
  const samples = reports(
    [100, 300, 200],
    [
      [10, 30],
      [50, 70],
      [1, 2],
    ],
  ).flat();
  samples[2]!.outcome = { exitCode: 1, signal: null, status: "failed" };
  assert.deepEqual(shardWeights(samples), {
    browser: { "tests/browser/one.spec.ts": 20 },
    viewer: {
      "tests/tooling-0.test.ts": 150,
      "tests/tooling-1.test.ts": 1,
    },
  });
});

test("shard weights reject a browser test without a wall time", () => {
  const [viewer, browser] = reports([1], [[1, 1]])[0]!;
  delete browser!.observedTests![0]!.wallMs;
  assert.throws(() => shardWeights([viewer, browser]), {
    message: "browser test chromium:test-0 has no wall time",
  });
});

test("the reporter's wall time adds the gap since the slot's previous test", () => {
  const reporter = new VerificationReporter();
  reporter.onBegin({ rootDir: "/repo/tests/browser" }, { allTests: () => [] });
  const write = process.stdout.write;
  process.stdout.write = () => true;
  try {
    for (const [title, start, duration, parallelIndex] of [
      ["first", 1000, 100, 0],
      ["second", 1500, 200, 0],
      ["other slot", 1600, 50, 1],
    ] as const)
      reporter.onTestEnd(playwrightTest(title), {
        startTime: new Date(start),
        duration,
        parallelIndex,
        status: "passed",
        errors: [],
      });
  } finally {
    process.stdout.write = write;
  }
  assert.deepEqual(
    reporter.observedTests.map((entry) => [entry.title, entry.wallMs]),
    [
      ["first", 100],
      ["second", 600],
      ["other slot", 50],
    ],
  );
});

function playwrightTest(title: string) {
  const spec = "/repo/tests/browser/a.spec.ts";
  const file = { type: "file", location: { file: spec } };
  return {
    id: title,
    location: { file: spec, line: 1, column: 1 },
    parent: { ...file, project: () => ({ name: "chromium" }) },
    titlePath: () => [title],
  };
}
