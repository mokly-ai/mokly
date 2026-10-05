import assert from "node:assert/strict";
import test from "node:test";

import { sampleOutcome } from "../scripts/large/outcomes.mjs";
import type { ReceivedTiming } from "../scripts/large/timings.mjs";

const input = {
  scenario: "no-changes",
  state: "cold",
  expectedChangedIds: [],
  expectedChangedRoutes: [],
  changedIds: [],
  changedRoutes: [],
};
const event = (
  stage: string,
  event: "start" | "end" | "counts",
  elapsedMs: number,
  extra = {},
): ReceivedTiming => ({
  receivedMs: elapsedMs,
  event: {
    schemaVersion: 1,
    session: "worker",
    pid: 1,
    role: "background",
    stage,
    event,
    id: stage === "changes.classify" ? 1 : 2,
    elapsedMs,
    ...extra,
  },
});

for (const stage of ["review.material-work", "review.document-work"])
  test(`timed samples reject material detail leaked through ${stage}`, () => {
    const result = sampleOutcome(
      [
        event("changes.classify", "start", 0),
        event(stage, "counts", 9, { counts: { materialBytes: 100 } }),
        event("changes.classify", "end", 10, {
          status: "ok",
          durationMs: 10,
        }),
      ],
      input,
    );
    assert.equal(result.outcome, "error");
    assert.equal(result.failurePhase, "measurement");
    assert.match(result.error!, /material.*detail/i);
    assert.equal(result.classificationMs, 10);
    assert.equal(Object.hasOwn(result, "materialWork"), false);
    assert.equal(Object.hasOwn(result, "companion"), false);
    assert.equal(result.documentWork, undefined);
  });

test("timed records reject and omit companion fields supplied by a caller", () => {
  for (const field of [
    "kind",
    "timed",
    "materialWork",
    "companionCounts",
    "companions",
    "materialBytes",
    "inlineFingerprintHashes",
  ]) {
    const result = sampleOutcome(
      [
        event("changes.classify", "start", 0),
        event("changes.classify", "end", 10, { status: "ok", durationMs: 10 }),
      ],
      { ...input, [field]: { unexpected: 1 } },
    );
    assert.equal(result.outcome, "error", field);
    assert.equal(Object.hasOwn(result, field), false, field);
    assert.equal(result.classificationMs, 10);
  }
});
