import assert from "node:assert/strict";
import test from "node:test";

import { companionOutcome } from "../scripts/large/companion_outcome.mjs";
import type { ReceivedTiming } from "../scripts/large/timings.mjs";

const counts = {
  materialBytes: 8,
  materialNormalizationBytes: 9,
  sourceNormalizationBytes: 10,
  materialHashBytes: 11,
  inlineFingerprintBytes: 12,
  inlineFingerprintHashes: 2,
  fingerprintedViews: 1,
  fingerprintSeams: 3,
  fingerprintSeamUnits: 72,
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
const records = [
  event("changes.classify", "start", 0),
  event("review.material-work", "counts", 9, { counts }),
  event("changes.classify", "end", 10, { status: "ok", durationMs: 10 }),
];
const input = {
  scenario: "no-changes",
  state: "cold",
  expectedChangedIds: [],
  expectedChangedRoutes: [],
  changedIds: [],
  changedRoutes: [],
  templateDigest: "template",
  fixtureCommit: "fixture",
  usableMs: 12,
  changesReadyMs: 13,
  classificationMs: 14,
};

test("companions label exact detail counts without timing fields", () => {
  const result = companionOutcome(records, input);
  assert.equal(result.outcome, "ok");
  assert.equal(result.kind, "material-work-companion");
  assert.equal(result.timed, false);
  assert.deepEqual(result.materialWork, counts);
  assert.equal(result.templateDigest, "template");
  assert.equal(result.fixtureCommit, "fixture");
  for (const field of [
    "state",
    "usableMs",
    "changesReadyMs",
    "classificationMs",
    "classificationStatus",
  ])
    assert.equal(Object.hasOwn(result, field), false, field);
});

test("companions require one valid detail record within the completed worker", () => {
  for (const invalid of [
    records.filter(({ event }) => event.stage !== "review.material-work"),
    [...records, records[1]!],
    records.map((record) =>
      record.event.stage !== "review.material-work"
        ? record
        : event("review.material-work", "counts", 11, { counts }),
    ),
    records.map((record) =>
      record.event.stage !== "review.material-work"
        ? record
        : event("review.material-work", "counts", 9, {
            counts: { ...counts, fingerprintSeamUnits: 73 },
          }),
    ),
  ])
    assert.equal(companionOutcome(invalid, input).outcome, "error");
  assert.equal(
    companionOutcome(records.slice(0, 1), input).outcome,
    "incomplete",
  );
  assert.equal(
    companionOutcome(records, { ...input, changedIds: ["wrong"] }).outcome,
    "membership-mismatch",
  );
  const noisy = [
    ...records,
    { ...records[1]!, event: { ...records[1]!.event, session: "another" } },
  ];
  assert.equal(companionOutcome(noisy, input).outcome, "ok");
});
