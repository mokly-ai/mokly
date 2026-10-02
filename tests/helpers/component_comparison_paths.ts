import assert from "node:assert/strict";
import path from "node:path";

import {
  runWithTimings,
  type TimingEvent,
} from "../../dist/diagnostics/timings.js";
import { ComponentDependencyPolicy } from "../../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../../dist/review/component_resources.js";
import { compareComponentView } from "../../dist/review/component_view.js";
import { CssResourceAnalysis } from "../../dist/review/css/resource_analysis.js";
import { ResourceComparison } from "../../dist/review/resource_comparison.js";
import { isManifestComponentVariant } from "../../packages/viewer/dist/components/manifest_types.js";
import { generatedViews } from "../../packages/viewer/dist/components/views.js";

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
  const dependencies = new ComponentDependencyPolicy(
    fixture.before,
    fixture.after,
    fixture.config.review.sharedImpact,
  );
  const changed = new Set(fixture.changedPaths);
  const prefix = path.relative(
    fixture.config.repoRoot,
    fixture.config.mockupsDir,
  );
  const compareResourceBytes = fixture.config.generatedOutput === "derived";
  const context = {
    componentAware: true,
    beforeReader,
    afterReader,
    dependencies,
    changed,
    prefix,
    compareResourceBytes,
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      changed,
      prefix,
      new CssResourceAnalysis(),
      compareResourceBytes,
      true,
    ),
  };
  let comparedViews = 0;
  for (const entry of fixture.after.entries) {
    if (entryIds && !entryIds.includes(entry.id)) continue;
    const before = fixture.before.entries.find(
      (candidate) => candidate.id === entry.id,
    );
    assert.ok(before);
    const beforeViews = generatedViews(before);
    for (const view of generatedViews(entry)) {
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
          `${entry.id}: ${view.path} inline analysis count`,
        );
      assert.equal(
        comparison.comparisonPath,
        expected,
        `${entry.id}: ${view.path}`,
      );
      comparedViews += 1;
    }
  }
  assert.ok(comparedViews > 0);
}
