import assert from "node:assert/strict";
import test from "node:test";

import { parseHtml } from "../dist/diagnostics/html_parse.js";
import {
  documentWorkSync,
  runWithDocumentWork,
  runWithTimings,
  timeAsync,
  timingDocumentWork,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";

test("document counters subtract nested local work and retain zero fields, UTF-8 bytes and rounded totals", async () => {
  let clock = 0;
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () =>
      runWithDocumentWork(async () => {
        documentWorkSync("projectionMs", () => {
          clock = 2;
          documentWorkSync("normalizationMs", () => {
            clock = 5.125;
          });
          clock = 10.125;
        });
        parseHtml("range", "<main>é</main>");
      }),
    { clock: () => clock, write: (event) => events.push(event) },
  );
  const counts = events.find(
    ({ stage, event }) =>
      stage === "review.document-work" && event === "counts",
  )!.counts!;
  assert.equal(counts.projectionMs, 7);
  assert.equal(counts.normalizationMs, 3.13);
  assert.equal(counts.rangeMs, 0);
  assert.equal(counts.htmlParses, 1);
  assert.equal(counts.htmlParseBytes, Buffer.byteLength("<main>é</main>"));
});

test("nested runWithDocumentWork reuses the outer collector and emits once", async () => {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "background",
    () =>
      timeAsync("changes.classify", () =>
        runWithDocumentWork(async () => {
          parseHtml(
            "legacyStylesheetMatching",
            "<main>Before the component loop</main>",
          );
          const collector = timingDocumentWork();
          assert.ok(collector);
          await runWithDocumentWork(async () => {
            assert.equal(timingDocumentWork(), collector);
            parseHtml("reference", "<main>Inside</main>");
          });
        }),
      ),
    { write: (event) => events.push(event) },
  );
  assert.equal(
    events.filter(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    ).length,
    1,
  );
  assert.equal(
    events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!.htmlParses,
    2,
  );
  assert.equal(timingDocumentWork(), undefined);
});

test("enabled build-time HTML parses have no classification counter state", async () => {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "build",
    async () => {
      assert.equal(timingDocumentWork(), undefined);
      parseHtml("range", "<main>Build</main>");
    },
    { write: (event) => events.push(event) },
  );
  assert.deepEqual(events, []);
});

test("handled classification failures emit partial counts and discard the collector", async () => {
  const events: TimingEvent[] = [];
  const failure = new Error("Comparison failed");
  await assert.rejects(
    runWithTimings(
      true,
      "background",
      () =>
        runWithDocumentWork(async () => {
          parseHtml("range", "<main>Partial</main>");
          throw failure;
        }),
      { write: (event) => events.push(event) },
    ),
    (error) => error === failure,
  );
  assert.deepEqual(
    events.filter(({ event }) => event === "counts").map(({ stage }) => stage),
    ["review.compare-screens", "review.document-work"],
  );
  assert.equal(events[1]!.counts!.htmlParses, 1);
  assert.equal(events[0]!.counts!.views, 0);
  assert.equal(events[0]!.counts!.heapPeakMiB, 0);
  assert.equal(timingDocumentWork(), undefined);
});
