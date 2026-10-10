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
  test(`resource fall-through after ignored text edits still attributes unchanged inline references in ${mode}`, async (context) => {
    const style = '<style>.actual-only{background:url("../owned.svg")}</style>';
    const ignored = (text: string) =>
      `<!--mokly-review-ignore:start:clock-->${text}<!--mokly-review-ignore:end:clock-->`;
    const fixture = await inlineChangesFixture(
      context,
      style + ignored("before"),
      style + ignored("after"),
      {
        colorSchemes: false,
        files: {
          before: { "owned.svg": "before" },
          after: { "owned.svg": "after" },
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
      const delivered = old.find(
        (result) => result.path === path && result.entryId === entryId,
      )!.comparison;
      assert.equal(comparison.comparisonPath, "complete", path);
      assert.deepEqual(comparison.reasons, delivered.reasons, path);
      assert.deepEqual(comparison.view, delivered.view, path);
      assert.deepEqual(
        comparison.ownedResources,
        delivered.ownedResources,
        path,
      );
      assert.deepEqual(
        comparison.changedImplementations,
        delivered.changedImplementations,
        path,
      );
    }
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(
      counts["htmlParses.pageAnalysis"],
      current.length * 2,
      "failed proof reuses both original analyses",
    );
    assert.equal(counts["htmlParses.linkNormalization"], 156);
    assert.equal(counts.htmlParses, current.length * 2 + 156);
  });
