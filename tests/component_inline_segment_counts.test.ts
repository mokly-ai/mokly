import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("a real small catalogue emits exactly one inline count record with parsing, reuse and fallback totals", async (context) => {
  const fixture = await componentReviewFixture(context, (source) => source);
  const entry = fixture.before.manifest.entries.find(
    ({ id }) => id === "home",
  )!;
  const selected = generatedViews(entry)[0]!;
  const documents = (
    outputs: ReadonlyMap<string, string>,
    color: string,
    failure: string,
  ) => {
    const files = new Map(outputs);
    files.set(
      selected.path,
      files
        .get(selected.path)!
        .replace(
          "</head>",
          `<style>.target{color:${color}}.common{display:block}.common{display:block}</style><style>${failure}{</style></head>`,
        ),
    );
    return { read: async (route: string) => Buffer.from(files.get(route)!) };
  };
  const events: TimingEvent[] = [];
  const result = await runWithTimings(
    true,
    "test",
    () =>
      classifyComponents({
        before: fixture.before.manifest,
        after: fixture.after.manifest,
        beforeReader: documents(fixture.before.outputs, "red", "a"),
        afterReader: documents(fixture.after.outputs, "blue", "b"),
        config: fixture.config,
        changedPaths: [],
        baseCommit: "a".repeat(40),
        baseRef: "main",
      }),
    { write: (event) => events.push(event) },
  );
  const records = events.filter(
    ({ stage, event }) =>
      stage === "review.inline-style-analysis" && event === "counts",
  );
  assert.equal(records.length, 1);
  assert.deepEqual(records[0]!.counts, {
    elements: 4,
    segments: 6,
    segmentHits: 3,
    segmentParses: 3,
    fallbacks: 2,
  });
  assert.deepEqual(
    result.changes.map(({ after, before }) => after?.id ?? before?.id),
    ["home"],
  );
  const paths = events.find(
    ({ stage, event }) =>
      stage === "review.compare-screens" && event === "counts",
  )!.counts!;
  assert.equal(paths.completePath, 1);
  assert.equal(paths.fastPath, paths.views! - 1);
});
