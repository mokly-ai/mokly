import assert from "node:assert/strict";
import test from "node:test";

import {
  documentMaterialWork,
  runWithComparisonWork,
  timingMaterialWork,
} from "../dist/diagnostics/material_timings.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { normalizeSingleDocument } from "../dist/review/ignore.js";

test("material details reuse only the owning comparison scope and emit independently", async () => {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () =>
      runWithComparisonWork(async () => {
        const outer = timingMaterialWork();
        assert.ok(outer);
        await runWithComparisonWork(async () => {
          assert.equal(timingMaterialWork(), outer);
          normalizeSingleDocument("é", "test");
        }, true);
        await runWithTimings(false, "disabled", () =>
          runWithComparisonWork(async () => {
            assert.equal(timingMaterialWork(), undefined);
            normalizeSingleDocument("ignored", "test");
          }, true),
        );
        await runWithTimings(
          true,
          "nested",
          () =>
            runWithComparisonWork(async () => {
              assert.notEqual(timingMaterialWork(), outer);
              normalizeSingleDocument("😀", "test");
            }, true),
          { write: (event) => events.push(event) },
        );
        assert.equal(timingMaterialWork(), outer);
      }, true),
    { write: (event) => events.push(event) },
  );
  const details = events.filter(
    (event) => event.stage === "review.material-work",
  );
  assert.equal(details.length, 2);
  assert.equal(
    details.find((event) => event.role === "test")!.counts!
      .sourceNormalizationBytes,
    2,
  );
  assert.equal(
    details.find((event) => event.role === "nested")!.counts!
      .sourceNormalizationBytes,
    4,
  );
  assert.equal(timingMaterialWork(), undefined);
  for (const event of events.filter(
    (event) => event.stage === "review.document-work",
  ))
    assert.equal(event.counts!.sourceNormalizationBytes, undefined);
});

test("detail collection emits exact partial counts after a failed operation", async () => {
  const events: TimingEvent[] = [];
  const error = new Error("operation failed");
  await assert.rejects(
    runWithTimings(
      true,
      "test",
      () =>
        runWithComparisonWork(async () => {
          documentMaterialWork(() => normalizeSingleDocument("é", "test"));
          throw error;
        }, true),
      { write: (event) => events.push(event) },
    ),
    (actual) => actual === error,
  );
  assert.equal(
    events.filter((event) => event.stage === "review.material-work").length,
    1,
  );
  assert.equal(
    events.find((event) => event.stage === "review.material-work")!.counts!
      .materialNormalizationBytes,
    2,
  );
  assert.equal(timingMaterialWork(), undefined);
});
