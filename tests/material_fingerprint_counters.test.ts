import assert from "node:assert/strict";
import test from "node:test";

import { stripComponentMarkers } from "../dist/components/comparison_material.js";
import {
  documentMaterialWork,
  runWithDocumentWork,
  runWithTimings,
  timingDocumentWork,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { normalizeSingleDocument } from "../dist/review/ignore.js";

test("material byte counters use UTF-8 and restore nested scope after failure", async () => {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () =>
      runWithDocumentWork(async () => {
        stripComponentMarkers("é");
        assert.throws(
          () =>
            documentMaterialWork(() => {
              stripComponentMarkers("😀");
              documentMaterialWork(() => normalizeSingleDocument("é", "test"));
              normalizeSingleDocument("x", "test");
              throw new Error("scope sentinel");
            }),
          /scope sentinel/,
        );
        normalizeSingleDocument("😀", "test");
        const work = timingDocumentWork()!;
        work.materials(["é", "😀"]);
        work.materialHash("é");
        work.inlineFingerprint("😀");
      }),
    { write: (event) => events.push(event) },
  );
  const counts = events.find(
    ({ stage, event }) =>
      stage === "review.document-work" && event === "counts",
  )!.counts!;
  assert.equal(counts.materialBytes, 6);
  assert.equal(counts.materialNormalizationBytes, 7);
  assert.equal(counts.sourceNormalizationBytes, 6);
  assert.equal(counts.materialHashBytes, 2);
  assert.equal(counts.inlineFingerprintBytes, 4);
  assert.equal(counts.inlineFingerprintHashes, 1);
});

test("disabled material scope allocates no collector or emits counts", async () => {
  const events: TimingEvent[] = [];
  await runWithTimings(
    false,
    "test",
    () =>
      runWithDocumentWork(async () => {
        documentMaterialWork(() => {
          assert.equal(timingDocumentWork(), undefined);
          assert.equal(normalizeSingleDocument("é", "test"), "é");
        });
      }),
    { write: (event) => events.push(event) },
  );
  assert.deepEqual(events, []);
});
