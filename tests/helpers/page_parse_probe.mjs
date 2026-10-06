import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock } from "node:test";

import { DocumentWork } from "../../dist/diagnostics/document_work.js";
import {
  runWithDocumentWork,
  runWithTimings,
} from "../../dist/diagnostics/timings.js";

const real = await import("parse5");
const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
const originals = new Set([
  ...input.beforeFiles.values(),
  ...input.afterFiles.values(),
]);
let parses = 0;
let currentStep;
const steps = {};
const recordedParse = DocumentWork.prototype.parse;
mock.method(
  DocumentWork.prototype,
  "parse",
  function (step, source, operation) {
    const previous = currentStep;
    currentStep = step;
    try {
      return recordedParse.call(this, step, source, operation);
    } finally {
      currentStep = previous;
    }
  },
);
function observe(source, options) {
  assert.ok(currentStep, "uncounted classification HTML parse");
  if (currentStep !== "linkNormalization")
    assert.ok(originals.has(source), "non-link parse used rewritten HTML");
  assert.equal(options?.sourceCodeLocationInfo, true);
  steps[currentStep] = (steps[currentStep] ?? 0) + 1;
  parses++;
}
class CountedParser extends real.Parser {
  static parse(source, options) {
    observe(source, options);
    return super.parse(source, options);
  }
}
mock.module("parse5", {
  namedExports: {
    ...real,
    Parser: CountedParser,
    parse(source, options) {
      observe(source, options);
      return real.parse(source, options);
    },
  },
});
const { comparePageFixture } = await import("./page_comparison.ts");
const events = [];
const results = await runWithTimings(
  true,
  "parse-probe",
  () => runWithDocumentWork(() => comparePageFixture(input)),
  { write: (event) => events.push(event) },
);
const complete = results.filter(
  ({ comparisonPath }) => comparisonPath === "complete",
).length;
const counts = events.find(
  ({ stage, event }) => stage === "review.document-work" && event === "counts",
).counts;
assert.equal(parses, counts.htmlParses, "every parse is counted");
assert.equal(steps.pageAnalysis, results.length + complete);
for (const [step, count] of Object.entries(steps))
  assert.equal(counts[`htmlParses.${step}`], count, step);
process.stdout.write(
  JSON.stringify({ parses, views: results.length, complete, steps }),
);
