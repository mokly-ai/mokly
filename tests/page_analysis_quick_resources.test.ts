import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { pageContext } from "./helpers/page_comparison.js";

for (const mode of ["committed", "derived"] as const)
  for (const changed of [false, true])
    test(`identical quick check uses ${mode} reader closures and reuses fall-through discovery, changed=${changed}`, async (context) => {
      const fixture = await componentReviewFixture(context, (source) => source);
      const view = generatedViews(
        fixture.after.manifest.entries.find(({ id }) => id === "home")!,
      )[0]!;
      const html =
        fixture.after.outputs.get(view.path)! +
        '<link rel="stylesheet" href="../root.css">';
      const reads = { before: [] as string[], after: [] as string[] };
      const materialReader = (side: keyof typeof reads) =>
        new ComponentMaterialReader({
          read: async (route) => {
            reads[side].push(route);
            if (route === view.path) return Buffer.from(html);
            if (route === "root.css") return Buffer.from('@import "leaf.css";');
            assert.equal(route, "leaf.css");
            return Buffer.from(
              changed && side === "after"
                ? ".none{color:blue}"
                : ".none{color:red}",
            );
          },
        });
      const beforeReader = materialReader("before");
      const afterReader = materialReader("after");
      const changedPaths = changed ? ["mockups/leaf.css"] : [];
      const compareResourceBytes = mode === "derived";
      const baseContext = pageContext({
        ...fixture,
        before: fixture.before.manifest,
        after: fixture.after.manifest,
        beforeFiles: fixture.before.outputs,
        afterFiles: fixture.after.outputs,
        config: { ...fixture.config, generatedOutput: mode },
        changedPaths,
      });
      const comparisonContext = {
        ...baseContext,
        beforeReader,
        afterReader,
        compareResourceBytes,
        resources: new ResourceComparison(
          beforeReader,
          afterReader,
          new Set(changedPaths),
          "mockups",
          undefined,
          compareResourceBytes,
          true,
        ),
      };
      const events: TimingEvent[] = [];
      const result = await runWithTimings(
        true,
        "test",
        () =>
          runWithDocumentWork(() =>
            compareComponentView(comparisonContext, view, view),
          ),
        { write: (event) => events.push(event) },
      );
      assert.equal(result.comparisonPath, changed ? "complete" : "fast");
      assert.equal(
        result.view.state,
        "unchanged",
        "unmatched CSS remains excluded",
      );
      const counts = events.find(
        ({ stage, event }) =>
          stage === "review.document-work" && event === "counts",
      )!.counts!;
      assert.equal(counts["htmlParses.pageAnalysis"], changed ? 2 : 1);
      assert.equal(
        counts.htmlParses,
        changed ? 2 : 1,
        "no material, matching or reference reparse",
      );
      assert.deepEqual(
        reads.after.sort(),
        [view.path, "root.css", "leaf.css"].sort(),
      );
      assert.deepEqual(
        reads.before.sort(),
        !changed && mode === "committed"
          ? [view.path]
          : [view.path, "root.css", "leaf.css"].sort(),
      );
      if (!changed) {
        assert.equal(
          events.filter(
            ({ stage, event }) =>
              stage === "review.resource-graph" && event === "start",
          ).length,
          compareResourceBytes ? 2 : 1,
        );
        assert.ok(
          !events.some(
            ({ stage, event }) =>
              stage === "review.inline-style-analysis" && event === "start",
          ),
        );
      }
    });

test("derived quick check traverses differing memberships independently, without a Git hint", async (context) => {
  const fixture = await componentReviewFixture(context, (source) => source);
  const view = generatedViews(
    fixture.after.manifest.entries.find(({ id }) => id === "home")!,
  )[0]!;
  const html =
    fixture.after.outputs.get(view.path)! +
    '<link rel="stylesheet" href="../root.css">';
  const input = {
    ...fixture,
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: new Map([
      ...fixture.before.outputs,
      [view.path, html],
      ["root.css", '@import "before.css";'],
      ["before.css", ".none{}"],
    ]),
    afterFiles: new Map([
      ...fixture.after.outputs,
      [view.path, html],
      ["root.css", '@import "after.css";'],
      ["after.css", ".none{}"],
    ]),
    config: { ...fixture.config, generatedOutput: "derived" as const },
    changedPaths: [],
  };
  const comparison = await compareComponentView(pageContext(input), view, view);
  assert.equal(comparison.comparisonPath, "complete");
  assert.equal(comparison.view.state, "changed");
  assert.deepEqual(comparison.reasons, [{ kind: "material" }]);
});
