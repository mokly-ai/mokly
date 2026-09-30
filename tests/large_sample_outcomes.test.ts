import assert from "node:assert/strict";
import test from "node:test";

import { sampleOutcome } from "../scripts/large/outcomes.mjs";
import type { ReceivedTiming } from "../scripts/large/timings.mjs";

function record(
  stage: string,
  event: "start" | "end" | "counts",
  elapsedMs: number,
  extra = {},
): ReceivedTiming {
  return {
    receivedMs: 1000 + elapsedMs,
    event: {
      schemaVersion: 1,
      session: "worker",
      pid: 2,
      role: "background",
      stage,
      event,
      elapsedMs,
      id: stage === "changes.classify" ? 1 : elapsedMs,
      ...extra,
    },
  };
}
const start = record("changes.classify", "start", 20);
const end = record("changes.classify", "end", 100, {
  durationMs: 80,
  status: "ok",
});
const base = {
  scenario: "no-changes",
  state: "cold",
  expectedChangedIds: [],
  expectedChangedRoutes: [],
};

test("completed outcomes use worker status, exact id membership and preserve successful diagnostics on browser failure", () => {
  const records = [
    start,
    record("review.inline-style-analysis", "end", 50, {
      durationMs: 40,
      status: "error",
    }),
    record("review.inline-style-analysis", "end", 60, {
      durationMs: 20,
      status: "ok",
    }),
    record("review.css-analysis", "end", 110, { durationMs: 30, status: "ok" }),
    record("review.compare-screens", "counts", 90, {
      counts: { views: 1, heapPeakMiB: 30 },
    }),
    record("review.document-work", "counts", 90, { counts: { htmlParses: 8 } }),
    end,
  ];
  const measured = sampleOutcome(records, {
    ...base,
    changedIds: [],
    changedRoutes: [],
  });
  assert.equal(measured.outcome, "ok");
  assert.equal(measured.inlineStyleAnalysisMs, 40);
  assert.equal(measured.cssAnalysisMs, 20);
  assert.equal(measured.inlineStyleAnalysisShare, 0.5);
  assert.equal(measured.heapPeakMiB, 30);
  assert.deepEqual(measured.documentWork, { htmlParses: 8 });
  const mismatch = sampleOutcome(records, {
    ...base,
    expectedChangedIds: ["one"],
    changedIds: ["two"],
    changedRoutes: ["screens/two.html"],
  });
  assert.equal(mismatch.outcome, "membership-mismatch");
  assert.deepEqual(mismatch.changedIds, ["two"]);
  const browserError = sampleOutcome(records, {
    ...base,
    error: "Browser closed",
    failurePhase: "browser",
  });
  assert.equal(browserError.outcome, "error");
  assert.equal(browserError.classificationStatus, "ok");
  assert.equal(browserError.classificationMs, 80);
  assert.equal(
    sampleOutcome(
      [start, { ...end, event: { ...end.event, status: "error" } }],
      base,
    ).classificationStatus,
    "error",
  );
});

test("heap-limit and delivery-ceiling samples never fabricate a worker or supervisor end", () => {
  const interval = record("review.inline-style-analysis", "end", 60, {
    durationMs: 50,
    status: "error",
  });
  const wait = {
    ...record("changes.classify", "end", 9999, { durationMs: 900 }),
    event: {
      ...end.event,
      role: "serve",
      session: "supervisor",
      elapsedMs: 9999,
      durationMs: 900,
    },
  };
  const records = [start, interval, wait];
  const measured = sampleOutcome(records, {
    ...base,
    error: "heap limit",
    failurePhase: "delivery",
  });
  assert.equal(measured.outcome, "incomplete");
  assert.equal(measured.classificationStatus, "incomplete");
  assert.equal(measured.classificationUpperBoundMs, 900);
  assert.equal(measured.inlineStyleAnalysisLowerBoundMs, 40);
  assert.equal(measured.classificationMs, undefined);
  assert.equal(measured.inlineStyleAnalysisShare, undefined);
  assert.equal(measured.heapPeakMiB, undefined);
  const waitStart = {
    ...wait,
    receivedMs: 2000,
    event: { ...start.event, role: "serve", session: "supervisor" },
  };
  const ceiling = sampleOutcome([start, interval, waitStart], {
    ...base,
    stopRequestedMs: 3500,
  });
  assert.equal(ceiling.classificationUpperBoundMs, undefined);
  assert.equal(ceiling.classificationWaitUntilStopMs, 1500);
  assert.equal(
    sampleOutcome([start, interval], { ...base, stopRequestedMs: 3500 })
      .classificationWaitUntilStopMs,
    undefined,
  );
  assert.equal(records.length, 3);
});

test("ambiguous spans and pre-classification infrastructure errors are errors, not invented status", () => {
  for (const records of [[], [start, start, end], [start, end, end]]) {
    const measured = sampleOutcome(records, {
      ...base,
      error: "infrastructure failure",
      failurePhase: "startup",
    });
    assert.equal(measured.outcome, "error");
    assert.equal(measured.classificationStatus, undefined);
    assert.equal(measured.classificationMs, undefined);
  }
  const failedInterval = record("review.css-analysis", "end", 80, {
    durationMs: 10,
    status: "error",
  });
  assert.equal(
    sampleOutcome([start, failedInterval, end], {
      ...base,
      changedIds: [],
      changedRoutes: [],
    }).cssAnalysisMs,
    10,
  );
  assert.equal(
    sampleOutcome(
      [
        start,
        {
          ...failedInterval,
          event: { ...failedInterval.event, session: "other" },
        },
        end,
      ],
      { ...base, changedIds: [], changedRoutes: [] },
    ).cssAnalysisMs,
    0,
  );
});
