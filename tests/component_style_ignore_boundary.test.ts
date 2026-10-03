import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { normalizeReviewPair } from "../dist/review/ignore.js";

import { pageContext } from "./helpers/page_comparison.js";
import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`style removal cannot bypass full validation of split ignore boundaries in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    for (const [name, style] of [
      [
        "opening tag attribute",
        (color: string) =>
          `<style data-ignore="<!--mokly-review-ignore:start:clock-->">.same{color:black}</style><!--mokly-review-ignore:end:clock--><style>.entry{color:${color}}</style>`,
      ],
      [
        "start marker ends at the outer span end",
        (color: string) =>
          `<style>.same{color:black}</style data-ignore=<!--mokly-review-ignore:start:clock-->><!--mokly-review-ignore:end:clock--><style>.entry{color:${color}}</style>`,
      ],
    ] as const)
      await context.test(name, async () => {
        const fixture = withHeadStyles(base, style("red"), style("blue"), mode);
        const { before, after } = selectedStyleViews(fixture);
        const text = (files: typeof fixture.beforeFiles) =>
          Buffer.from(files.get(after.path)!).toString();
        assert.deepEqual(
          normalizeReviewPair(
            text(fixture.beforeFiles),
            text(fixture.afterFiles),
            after.path,
          ).pairedIgnoreIds,
          ["clock"],
        );
        for (const useStylePath of [true, false]) {
          const events: TimingEvent[] = [];
          await assert.rejects(
            runWithTimings(
              true,
              "test",
              () =>
                runWithDocumentWork(() =>
                  compareComponentView(
                    { ...pageContext(fixture), useStylePath },
                    before,
                    after,
                  ),
                ),
              { write: (event) => events.push(event) },
            ),
            {
              message: `[mokly/review-ignore] ${after.path}: end marker for clock has no start`,
            },
          );
          const work = events.find(
            ({ stage, event }) =>
              stage === "review.document-work" && event === "counts",
          )!.counts!;
          assert.equal(
            work["htmlParses.pageAnalysis"],
            2,
            "both original sides reached complete comparison",
          );
          const paths = events.find(
            ({ stage, event }) =>
              stage === "review.compare-screens" && event === "counts",
          )!.counts!;
          assert.equal(
            paths.views,
            0,
            "validation failures do not count as completed views",
          );
        }
      });
  });
