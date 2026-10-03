import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
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
    const classify = (
      useStylePath: boolean,
      useFastPath = true,
      identical = false,
    ) =>
      classifyComponents({
        before: input.before,
        after: identical ? input.before : input.after,
        config: input.config,
        beforeReader: memoryReader(input.beforeFiles),
        afterReader: memoryReader(
          identical ? input.beforeFiles : input.afterFiles,
        ),
        changedPaths: identical ? [] : input.changedPaths,
        baseCommit: "a".repeat(40),
        baseRef: "main",
        useStylePath,
        useFastPath,
      });
    const events: TimingEvent[] = [];
    const actual = await runWithTimings(true, "test", () => classify(true), {
      write: (event) => events.push(event),
    });
    const records = events.filter(
      ({ stage, event }) =>
        stage === "review.compare-screens" && event === "counts",
    );
    assert.equal(records.length, 1);
    const counts = records[0]!.counts!;
    assert.ok(Number.isFinite(counts.heapPeakMiB) && counts.heapPeakMiB! > 0);
    assert.deepEqual(counts, {
      views: 64,
      stylePath: 64,
      fastPath: 0,
      completePath: 0,
      heapPeakMiB: counts.heapPeakMiB,
    });
    assert.deepEqual(actual, await classify(false));
    assert.deepEqual(actual, await classify(false, false));
    assert.deepEqual(
      actual.changes.map(({ before, after }) => (after ?? before)!.id),
      ["area-1-action"],
    );
    const unchangedEvents: TimingEvent[] = [];
    const unchanged = await runWithTimings(
      true,
      "test",
      () => classify(true, true, true),
      {
        write: (event) => unchangedEvents.push(event),
      },
    );
    assert.deepEqual(unchanged, await classify(false, false, true));
    const unchangedCounts = unchangedEvents.filter(
      ({ stage, event }) =>
        stage === "review.compare-screens" && event === "counts",
    );
    assert.equal(unchangedCounts.length, 1);
    assert.deepEqual(unchangedCounts[0]!.counts, {
      views: 64,
      fastPath: 64,
      stylePath: 0,
      completePath: 0,
      heapPeakMiB: unchangedCounts[0]!.counts!.heapPeakMiB,
    });
    context.diagnostic(
      `${mode}: 64 identical views settled by the quick check`,
    );
  }
});
