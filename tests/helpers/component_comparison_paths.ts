import assert from "node:assert/strict";
import path from "node:path";

import {
  runWithTimings,
  type TimingEvent,
} from "../../dist/diagnostics/timings.js";
import { ComponentMaterialReader } from "../../dist/review/component_resources.js";
import { compareComponentView } from "../../dist/review/component_view.js";
import { CssResourceAnalysis } from "../../dist/review/css/resource_analysis.js";
import { catalogueLinkNormalizer } from "../../dist/review/moves/links.js";
import { ResourceComparison } from "../../dist/review/resource_comparison.js";
import { reviewViews } from "../../dist/review/views.js";
import { isManifestComponentVariant } from "../../packages/viewer/dist/components/manifest_types.js";

import { memoryReader, type FastPathFixture } from "./component_fast_path.js";

/** Prove the comparison route for every named generated view, not bystanders. */
export async function assertComparisonPaths(
  fixture: FastPathFixture,
  expected: "fast" | "complete",
  entryIds?: readonly string[],
  expectedInlineAnalyses?: number,
): Promise<void> {
  const beforeReader = new ComponentMaterialReader(
    memoryReader(fixture.beforeFiles),
  );
  const afterReader = new ComponentMaterialReader(
    memoryReader(fixture.afterFiles),
  );
  const changed = new Set(fixture.changedPaths);
  const prefix = path.relative(
    fixture.config.repoRoot,
    fixture.config.mockupsDir,
  );
  const context = {
    componentAware: true,
    links: catalogueLinkNormalizer(
      fixture.before.entries,
      fixture.after.entries,
      [],
    ),
    beforeReader,
    afterReader,
    changed,
    prefix,
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      changed,
      prefix,
      new CssResourceAnalysis(),
      undefined,
      true,
    ),
  };
  let comparedViews = 0;
  for (const entry of fixture.after.entries) {
    if (entryIds && !entryIds.includes(entry.path)) continue;
    const before = fixture.before.entries.find(
      (candidate) => candidate.path === entry.path,
    );
    assert.ok(before);
    const beforeViews = reviewViews(before);
    for (const view of reviewViews(entry)) {
      const base = beforeViews.find(
        (candidate) => candidate.path === view.path,
      );
      assert.ok(base);
      const events: TimingEvent[] = [];
      const comparison = await runWithTimings(
        expectedInlineAnalyses !== undefined,
        "test",
        () =>
          compareComponentView(
            context,
            base,
            view,
            entry.kind === "component" && isManifestComponentVariant(entry)
              ? entry.variantOf
              : undefined,
          ),
        { write: (event) => events.push(event) },
      );
      if (expectedInlineAnalyses !== undefined)
        assert.equal(
          events.filter(
            (event) =>
              event.stage === "review.inline-style-analysis" &&
              event.event === "start",
          ).length,
          expectedInlineAnalyses,
          `${entry.path}: ${view.path} inline analysis count`,
        );
      assert.equal(
        comparison.comparisonPath,
        expected,
        `${entry.path}: ${view.path}`,
      );
      comparedViews += 1;
    }
  }
  assert.ok(comparedViews > 0);
}
