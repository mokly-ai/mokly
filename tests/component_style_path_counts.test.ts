import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { compareComponentViews } from "../dist/review/component_compare_views.js";
import { entryViewPairs } from "../dist/review/component_pairing.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { pageContext } from "./helpers/page_comparison.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`production counts one style and one fallback view in ${mode}`, async (context) => {
    const fixture = withHeadStyles(
      await styleRouteFixture(context),
      "<style>.entry{color:red}</style>",
      "<style>.entry{color:blue}</style>",
      mode,
    );
    const after = generatedViews(
      fixture.after.entries.find(({ path: id }) => id === "home")!,
    );
    assert.equal(after.length, 2);
    const fallback = after[1]!.path;
    const input = {
      ...fixture,
      afterFiles: new Map([
        ...fixture.afterFiles,
        [
          fallback,
          Buffer.from(fixture.afterFiles.get(fallback)!)
            .toString()
            .replace("<style>", '<style data-sheet="changed">'),
        ],
      ]),
    };
    const events: TimingEvent[] = [];
    const beforeEntry = fixture.before.entries.find(
      (entry) => entry.path === "home",
    );
    const afterEntry = fixture.after.entries.find(
      (entry) => entry.path === "home",
    );
    assert.ok(beforeEntry?.kind === "screen" && afterEntry?.kind === "screen");
    const results = await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(() =>
          compareComponentViews(
            pageContext(input),
            entryViewPairs(
              { before: beforeEntry, after: afterEntry },
              new Map(),
              new Map(),
              [],
            ).views,
          ),
        ),
      { write: (event) => events.push(event) },
    );
    assert.deepEqual(
      results.map(({ comparisonPath }) => comparisonPath),
      ["style", "complete"],
    );
    const records = events.filter(
      ({ stage, event }) =>
        stage === "review.compare-screens" && event === "counts",
    );
    assert.equal(records.length, 1);
    const counts = records[0]!.counts!;
    assert.ok(Number.isFinite(counts.heapPeakMiB) && counts.heapPeakMiB! > 0);
    assert.deepEqual(counts, {
      views: 2,
      stylePath: 1,
      fastPath: 0,
      completePath: 1,
      heapPeakMiB: counts.heapPeakMiB,
    });
  });
