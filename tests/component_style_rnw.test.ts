import assert from "node:assert/strict";
import test from "node:test";

import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { memoryReader } from "./helpers/component_fast_path.js";
import { assertStyleRoute } from "./helpers/style_route.js";
import { styleRouteLargeFixture } from "./helpers/style_route_large.js";

test("every eligible cumulative RNW component-style view routes with exact catalogue equality in both modes", async (context) => {
  const fixture = await styleRouteLargeFixture(context);
  for (const mode of ["committed", "derived"] as const) {
    const input = {
      ...fixture,
      config: { ...fixture.config, generatedOutput: mode },
    };
    let routed = 0;
    for (const entry of fixture.after.entries)
      for (const view of generatedViews(entry)) {
        if (entry.kind === "page") continue;
        const base = Buffer.from(
          fixture.beforeFiles.get(view.path)!,
        ).toString();
        const head = Buffer.from(fixture.afterFiles.get(view.path)!).toString();
        await assertStyleRoute(
          input,
          base === head ? "fast" : "style",
          entry.id,
          true,
          view.path,
        );
        if (base !== head) routed++;
      }
    assert.ok(routed >= 40, `eligible routed views: ${routed}`);
    context.diagnostic(
      `${mode}: ${routed} eligible views settled by the style route`,
    );
    const classify = (useStylePath: boolean, useFastPath = true) =>
      classifyComponents({
        before: input.before,
        after: input.after,
        config: input.config,
        beforeReader: memoryReader(input.beforeFiles),
        afterReader: memoryReader(input.afterFiles),
        changedPaths: input.changedPaths,
        baseCommit: "a".repeat(40),
        baseRef: "main",
        useStylePath,
        useFastPath,
      });
    const actual = await classify(true);
    assert.deepEqual(actual, await classify(false));
    assert.deepEqual(actual, await classify(false, false));
    assert.deepEqual(
      actual.changes.map(({ before, after }) => (after ?? before)!.id),
      ["area-1-action"],
    );
  }
});
