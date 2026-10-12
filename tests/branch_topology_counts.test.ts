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

test("invocation line shifts alone keep every view on the fast path", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => "\n\n" + source);
  const reader = (outputs: ReadonlyMap<string, GeneratedFile>) => ({
    read: async (route: string) => {
      const content = outputs.get(route.replace(/^mokly-generated\//, ""));
      assert.notEqual(content, undefined, route);
      return generatedBytes(content!);
    },
  });
  const events: TimingEvent[] = [];
  const result = await runWithTimings(
    true,
    "test",
    () =>
      classifyComponents({
        before: fixture.before.manifest,
        after: fixture.after.manifest,
        beforeReader: reader(fixture.before.outputs),
        afterReader: reader(fixture.after.outputs),
        config: fixture.config,
        changedPaths: fixture.changedPaths,
        baseCommit: "a".repeat(40),
        baseRef: "main",
      }),
    { write: (event) => events.push(event) },
  );
  const counts = events.find(
    (event) =>
      event.stage === "review.compare-screens" && event.event === "counts",
  )?.counts;

  const views = fixture.after.manifest.entries.reduce(
    (count, entry) => count + generatedViews(entry).length,
    0,
  );

  assert.deepEqual(result.changes, []);
  assert.ok(views > 0);
  assert.ok((counts?.heapPeakMiB ?? 0) > 0);
  const { heapPeakMiB: _heap, ...paths } = counts!;
  assert.deepEqual(paths, {
    views,
    fastPath: views,
    completePath: 0,
    stylePath: 0,
  });
});
