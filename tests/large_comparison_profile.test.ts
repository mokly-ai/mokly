import assert from "node:assert/strict";
import test from "node:test";

import { comparisonProfile } from "../scripts/large/comparison_profile.js";
import type { TimingRecord } from "../scripts/large/timings.js";

function span(
  stage: string,
  elapsedMs: number,
  durationMs: number,
  other: Record<string, unknown> = {},
): TimingRecord {
  return {
    receivedMs: 1000,
    event: {
      schemaVersion: 1,
      role: "core",
      pid: 1,
      session: "one",
      id: 1,
      event: "end",
      status: "ok",
      stage,
      elapsedMs,
      durationMs,
      ...other,
    },
  };
}

test("CSS share uses a clipped interval union on the classification clock", () => {
  const result = comparisonProfile([
    span("changes.classify", 100, 80),
    span("review.css-analysis", 40, 30),
    span("review.css-analysis", 60, 30),
    span("review.css-analysis", 110, 20),
    span("review.css-analysis", 80, 80, { pid: 2 }),
    span("review.css-analysis", 80, 80, { session: "two" }),
    span("review.css-analysis", 80, 80, { role: "sidecar" }),
    span("review.css-analysis", 80, 80, { event: "start" }),
  ]);
  assert.deepEqual(result, [
    {
      session: "one",
      pid: 1,
      id: 1,
      status: "ok",
      durationMs: 80,
      cssMs: 50,
      cssShare: 0.625,
    },
  ]);
});

test("separate classifications keep separate CSS shares and zero has no ratio", () => {
  const result = comparisonProfile([
    span("changes.classify", 100, 100),
    span("review.css-analysis", 50, 25),
    span("changes.classify", 200, 50, { id: 2 }),
    span("review.css-analysis", 180, 10),
    span("changes.classify", 200, 0, { id: 3 }),
  ]);
  assert.deepEqual(
    result.map((item) => item.cssShare),
    [0.25, 0.2, null],
  );
  assert.deepEqual(comparisonProfile([]), []);
});
