import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { comparePageFixture, pageContext } from "./helpers/page_comparison.js";

for (const mode of ["committed", "derived"] as const)
  for (const changed of [false, true])
    test(`shared page analysis parses ${changed ? "both originals" : "only head"} once in ${mode}`, async (context) => {
      const fixture = await componentReviewFixture(context, (source) =>
        changed ? source.replace("Screen content", "Changed screen") : source,
      );
      fixture.config.generatedOutput = mode;
      const events: TimingEvent[] = [];
      const results = await runWithTimings(
        true,
        "test",
        () =>
          runWithDocumentWork(() =>
            comparePageFixture({
              ...fixture,
              before: fixture.before.manifest,
              after: fixture.after.manifest,
              beforeFiles: fixture.before.outputs,
              afterFiles: fixture.after.outputs,
            }),
          ),
        { write: (event) => events.push(event) },
      );
      const counts = events.find(
        ({ stage, event }) =>
          stage === "review.document-work" && event === "counts",
      )!.counts!;
      const complete = results.filter(
        ({ comparisonPath }) => comparisonPath === "complete",
      ).length;
      assert.equal(counts.htmlParses, results.length + complete);
      assert.equal(
        counts["htmlParses.pageAnalysis"],
        results.length + complete,
      );
      if (!changed) {
        assert.equal(complete, 0);
        assert.ok(
          !events.some(
            ({ stage, event }) =>
              stage === "review.inline-style-analysis" && event === "start",
          ),
        );
      }
    });

test("added and removed views parse their sole original side exactly once", async (context) => {
  const fixture = await componentReviewFixture(context, (source) => source);
  const view = generatedViews(
    fixture.after.manifest.entries.find(({ id }) => id === "home")!,
  )[0]!;
  const input = {
    ...fixture,
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: fixture.before.outputs,
    afterFiles: fixture.after.outputs,
  };
  for (const side of ["before", "after"] as const) {
    const events: TimingEvent[] = [];
    const comparison = await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(() =>
          compareComponentView(
            pageContext(input),
            side === "before" ? view : undefined,
            side === "after" ? view : undefined,
          ),
        ),
      { write: (event) => events.push(event) },
    );
    assert.equal(
      comparison.view.state,
      side === "before" ? "removed" : "added",
    );
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts.htmlParses, 1);
    assert.equal(counts["htmlParses.pageAnalysis"], 1);
  }
});
