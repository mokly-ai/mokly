import assert from "node:assert/strict";
import { mock } from "node:test";

const locations = await import("../../dist/review/page_source_locations.js");
const { MoklyError } = await import("../../dist/errors.js");
const scenario = process.argv[2];
const expected = new MoklyError(
  "review-invalid",
  "element has no creating token provenance",
);
const calls = [];
class FaultyLocations extends locations.PageSourceLocations {
  processing(token) {
    if (scenario === "once") super.processing(token);
  }
}
mock.module("../../dist/review/page_source_locations.js", {
  namedExports: {
    ...locations,
    PageSourceLocations: FaultyLocations,
    withPageSourceValidation(document, analyze) {
      return locations.withPageSourceValidation(document, (validate) =>
        analyze(
          validate &&
            ((element) => {
              if (!element.sourceCodeLocation) calls.push(element.tagName);
              validate(element);
            }),
        ),
      );
    },
  },
});
const { PageAnalysis } = await import("../../dist/review/page_analysis.js");
const { analyzeResourceDocument } =
  await import("../../dist/review/resource_document_analysis.js");
const { pageReferenceRecords } =
  await import("../../dist/review/page_reference_records.js");
const source =
  "<html><head></head><body><p>Home</p><!--mokly-review-ignore:start:clock--></p><!--mokly-review-ignore:end:clock--></body></html>";
const sameError = (error) =>
  error instanceof MoklyError &&
  error.code === expected.code &&
  error.message === expected.message;
if (scenario === "view")
  assert.throws(() => new PageAnalysis(source, "view.html"), sameError);
else if (scenario === "embedded")
  assert.throws(
    () =>
      analyzeResourceDocument(
        source,
        source,
        "frame.html",
        "resourceReference",
      ),
    sameError,
  );
else {
  const analysis = new PageAnalysis(source, "view.html");
  assert.deepEqual(
    calls,
    ["p"],
    "validate creating provenance during construction",
  );
  pageReferenceRecords(source, analysis.document);
  pageReferenceRecords(source, analysis.document);
  assert.deepEqual(calls, ["p"], "validate once per registered document");
}
process.stdout.write(JSON.stringify({ scenario, calls }));
