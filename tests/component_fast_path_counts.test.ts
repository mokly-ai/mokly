import assert from "node:assert/strict";
import test from "node:test";

import {
  generatedBytes,
  type GeneratedFile,
} from "../dist/build/generated_file.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test(`zero-change classification discovers each required side once`, async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const events: TimingEvent[] = [];
  const reader = (outputs: ReadonlyMap<string, GeneratedFile>) => ({
    read: async (route: string) => {
      const content = outputs.get(route.replace(/^mokly-generated\//, ""));
      assert.notEqual(content, undefined, route);
      return generatedBytes(content!);
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
        config: fixture.config,
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
  const { heapPeakMiB, ...pathCounts } = counts!.counts!;
  assert.ok(heapPeakMiB! > 0);
  assert.deepEqual(pathCounts, {
    views,
    fastPath: views,
    completePath: 0,
    stylePath: 0,
  });
  assert.equal(
    events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length,
    views * 2,
  );
});
