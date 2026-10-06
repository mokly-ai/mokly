import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";
import { identicalPageQuickCheck } from "../dist/review/page_quick_check.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { pageContext } from "./helpers/page_comparison.js";

for (const mode of ["committed", "derived"] as const)
  for (const changed of [false, true])
    test(`identical quick check uses ${mode} reader closures and reuses fall-through discovery, changed=${changed}`, async (context) => {
      const fixture = await componentReviewFixture(context, (source) => source);
      const view = generatedViews(
        fixture.after.manifest.entries.find(({ path: id }) => id === "home")!,
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
        changed ? 20 : 1,
        "only original analyses and counted link normalization parse",
      );
      assert.equal(
        counts["htmlParses.linkNormalization"] ?? 0,
        changed ? 18 : 0,
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
      assert.equal(
        events.filter(
          ({ stage, event }) =>
            stage === "review.resource-graph" && event === "start",
        ).length,
        changed ? 4 : compareResourceBytes ? 2 : 1,
      );
      if (!changed) {
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
    fixture.after.manifest.entries.find(({ path: id }) => id === "home")!,
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
  const reads = { before: [] as string[], after: [] as string[] };
  const reader = (side: keyof typeof reads) => {
    const files = side === "before" ? input.beforeFiles : input.afterFiles;
    const read = (route: string) => {
      const content = files.get(route);
      if (content !== undefined) reads[side].push(route);
      return content === undefined
        ? undefined
        : typeof content === "string"
          ? Buffer.from(content)
          : Buffer.from(content);
    };
    return new ComponentMaterialReader({
      read: async (route) => {
        const content = read(route);
        assert.ok(content);
        return content;
      },
      readIfExists: async (route) => read(route),
    });
  };
  const beforeReader = reader("before");
  const afterReader = reader("after");
  const contextForView = {
    ...pageContext(input),
    beforeReader,
    afterReader,
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      new Set(),
      "mockups",
      undefined,
      true,
      true,
    ),
  };
  const quick = await identicalPageQuickCheck(
    contextForView,
    new PageAnalysisPair(view, view, html, html),
    {
      viewport: view.viewport,
      colorScheme: view.colorScheme,
      state: "unchanged",
      ignoredIds: [],
    },
  );
  assert.equal(quick, undefined, "unequal reader closures must fall through");
  assert.ok(reads.before.includes("before.css"));
  assert.ok(!reads.before.includes("after.css"));
  assert.ok(reads.after.includes("after.css"));
  assert.ok(!reads.after.includes("before.css"));
  const comparison = await compareComponentView(contextForView, view, view);
  assert.equal(comparison.comparisonPath, "complete");
  assert.equal(comparison.view.state, "changed");
  assert.deepEqual(comparison.reasons, [{ kind: "material" }]);
});
