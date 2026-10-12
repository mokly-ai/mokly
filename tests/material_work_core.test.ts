import assert from "node:assert/strict";
import test from "node:test";

import { DocumentWork } from "../dist/diagnostics/document_work.js";
import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { normalizeSingleDocument } from "../dist/review/ignore.js";

const coreFields = [
  "htmlParses",
  "htmlParseBytes",
  "htmlParseMs",
  "rangeMs",
  "styleDiscoveryMs",
  "referenceMs",
  "matchingMs",
  "normalizationMs",
  "projectionMs",
  "implementationMs",
  "inlineRuleMs",
  "hashMs",
].sort();

test("the core collector retains the M8 instance and counter shape", () => {
  const work = new DocumentWork(
    () => 0,
    () => 0,
  );
  assert.deepEqual(Object.keys(work).sort(), [
    "clock",
    "counts",
    "heapPeak",
    "heapSample",
    "inlineStyles",
    "paths",
    "resourceReference",
    "stack",
  ]);
  assert.deepEqual(Object.keys(work.record()).sort(), coreFields);
  assert.deepEqual(Object.getOwnPropertyNames(DocumentWork.prototype).sort(), [
    "comparedView",
    "comparisonCounts",
    "constructor",
    "measure",
    "parse",
    "record",
    "resourceReferences",
  ]);
});

test("ordinary timing collection emits only M8 core fields", async () => {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () =>
      runWithDocumentWork(async () => {
        assert.equal(normalizeSingleDocument("é", "test"), "é");
      }),
    { write: (event) => events.push(event) },
  );
  const counts = events.find(
    (event) => event.stage === "review.document-work",
  )!.counts!;
  assert.deepEqual(Object.keys(counts).sort(), coreFields);
  assert.ok(!events.some((event) => event.stage === "review.material-work"));
});
