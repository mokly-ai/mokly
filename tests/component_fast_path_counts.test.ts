import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const generatedOutput of ["committed", "derived"] as const)
  test(`zero-change ${generatedOutput} classification discovers each required side once`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) => source);
    const events: TimingEvent[] = [];
    const reader = (outputs: ReadonlyMap<string, string>) => ({
      read: async (route: string) => {
        const content = outputs.get(route);
        assert.notEqual(content, undefined, route);
        return Buffer.from(content!);
      },
    });
    await runWithTimings(
      true,
      "test",
      () =>
        classifyComponents({
          before: fixture.before.manifest,
          after: fixture.after.manifest,
          beforeReader: reader(fixture.before.outputs),
          afterReader: reader(fixture.after.outputs),
          config: { ...fixture.config, generatedOutput },
          changedPaths: [],
          baseCommit: "a".repeat(40),
          baseRef: "main",
        }),
      { write: (event) => events.push(event) },
    );
    const views = fixture.after.manifest.entries.reduce(
      (count, entry) => count + generatedViews(entry).length,
      0,
    );
    const counts = events.find(
      (event) =>
        event.stage === "review.compare-screens" && event.event === "counts",
    );
    assert.deepEqual(counts?.counts, {
      views,
      fastPath: views,
      completePath: 0,
    });
    assert.equal(
      events.filter(
        (event) =>
          event.stage === "review.resource-graph" && event.event === "start",
      ).length,
      views * (generatedOutput === "derived" ? 2 : 1),
    );
  });
