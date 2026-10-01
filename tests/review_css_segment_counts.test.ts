import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  timingDocumentWork,
  type TimingEvent,
} from "../src/diagnostics/timings.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

async function counts(
  operation: (parser: CssResourceAnalysis["parser"]) => void,
) {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () =>
      runWithDocumentWork(async () =>
        operation(new CssResourceAnalysis().parser),
      ),
    { write: (event) => events.push(event) },
  );
  const records = events.filter(
    ({ stage, event }) =>
      stage === "review.inline-style-analysis" && event === "counts",
  );
  assert.equal(records.length, 1);
  return records[0]!.counts;
}

test("inline counts include element-side occurrences, successful segments, distinct misses and verified duplicates", async () => {
  assert.deepEqual(
    await counts((parser) => {
      parser.parseInline!(".a{} .a{} .b{}");
      parser.parseInline!(".a{} .b{} .c{}");
      parser.parseInline!(" \t/*trivia*/");
    }),
    {
      elements: 3,
      segments: 6,
      segmentHits: 3,
      segmentParses: 3,
      fallbacks: 0,
    },
  );
});

test("scanner anomalies contribute no partial segments; contextual fallbacks keep existing hits but attempt no batch", async () => {
  assert.deepEqual(
    await counts((parser) => {
      parser.parseInline!(".a{}");
      parser.parseInline!(".a{} trailing");
      parser.parseInline!('@import "theme.css";.a{}');
    }),
    {
      elements: 3,
      segments: 3,
      segmentHits: 1,
      segmentParses: 1,
      fallbacks: 2,
    },
  );
});

test("failed batches count distinct attempted misses but not their unverified duplicates", async () => {
  assert.deepEqual(
    await counts((parser) => {
      parser.parseInline!(".a{}");
      parser.parseInline!(".a{} .b{broken} .b{broken}");
    }),
    {
      elements: 2,
      segments: 4,
      segmentHits: 1,
      segmentParses: 2,
      fallbacks: 1,
    },
  );
});

test("disabled timings give inline parsing no document-work collector and emit no records", async () => {
  const native = new LightningCssRuleParser();
  const events: TimingEvent[] = [];
  await runWithTimings(
    false,
    "test",
    () =>
      runWithDocumentWork(async () => {
        const parser = new CssResourceAnalysis({
          parse(text) {
            assert.equal(timingDocumentWork(), undefined);
            return native.parse(text);
          },
          parseSegments(texts) {
            assert.equal(timingDocumentWork(), undefined);
            return native.parseSegments(texts);
          },
        }).parser;
        parser.parseInline!(".a{}");
        parser.parseInline!(".b{");
        assert.equal(timingDocumentWork(), undefined);
      }),
    { write: (event) => events.push(event) },
  );
  assert.equal(timingDocumentWork(), undefined);
  assert.deepEqual(events, []);
});
