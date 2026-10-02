import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const mode of ["committed", "derived"] as const)
  test(`embedded HTML keeps ignored siblings as selector context in ${mode}`, async (context) => {
    const frame =
      '<div><!--mokly-review-ignore:start:context--><i class="ignored"></i><!--mokly-review-ignore:end:context--><b class="subject"></b></div><link rel="stylesheet" href="sheet.css">';
    const fixture = await inlineChangesFixture(
      context,
      '<iframe src="../frame.html"></iframe>',
      '<iframe src="../frame.html"></iframe>',
      {
        colorSchemes: false,
        files: {
          before: {
            "frame.html": frame,
            "sheet.css": ".ignored + .subject{color:red}",
          },
          after: {
            "frame.html": frame,
            "sheet.css": ".ignored + .subject{color:blue}",
          },
        },
      },
    );
    const input = await pageFixtureInput(fixture, mode);
    const events: TimingEvent[] = [];
    const current = await runWithTimings(
      true,
      "test",
      () => runWithDocumentWork(() => comparePageViews(input)),
      { write: (event) => events.push(event) },
    );
    const old = await comparePageViews(input, true);
    for (const { entryId, path, comparison } of current.filter(
      ({ entryId }) => entryId === "home",
    )) {
      assert.equal(
        old.find(
          (result) => result.path === path && result.entryId === entryId,
        )!.comparison.view.state,
        "unchanged",
        "M6 lost ignored sibling context",
      );
      assert.equal(comparison.view.state, "changed", path);
      const dependency = comparison.reasons.find(
        (reason) =>
          reason.kind === "dependency" && reason.path === "mockups/sheet.css",
      );
      assert.ok(dependency && dependency.kind === "dependency");
      assert.equal(dependency.analysis?.status, "matched", path);
    }
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts["htmlParses.pageAnalysis"], current.length * 2);
    assert.equal(
      counts["htmlParses.resourceReference"],
      2,
      "each reader parses its embedded document once",
    );
    assert.equal(
      counts["htmlParses.resourceMatching"],
      2,
      "one original matching tree per reader, reused by both comparisons",
    );
  });
