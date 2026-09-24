import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";
import type { ReviewResultV5 } from "../packages/viewer/dist/review/component_types.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
  type FastPathFixture,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("nested identical-render inputs preserve implementation impact", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      '<section>{props.children}<action.Component label="Inside" /></section>',
      '<section>{props.children}<action.Component label="Inside" disabled={false} /></section>',
    ),
  );
  const result = await assertFastPathEquivalent(reviewFixture(fixture));

  assert.deepEqual(reasonKinds(result, "pane"), ["inputs", "material"]);
});

test("slot-bearing instance renames preserve projected material", async (t) => {
  const source = componentEntrySource({
    body: '<pane.Component moklyInstance="alpha"><p>Screen content</p></pane.Component>',
  });
  const fixture = await componentReviewFixture(
    t,
    (current) =>
      current.replaceAll('moklyInstance="alpha"', 'moklyInstance="beta"'),
    source,
  );
  const result = await assertFastPathEquivalent(reviewFixture(fixture));

  assert.deepEqual(reasonKinds(result, "home"), ["material", "structure"]);
});

test("marker movement with identical stripped HTML preserves consumer material", async (t) => {
  const source = componentEntrySource({
    body: '<action.Component moklyInstance="footer" label="Finish" /><i></i>',
  });
  const fixture = await componentReviewFixture(
    t,
    (current) =>
      current
        .replace(
          "(props, context) => props.hidden ? null : <button data-viewport={context.viewport} disabled={props.disabled}>{props.label}</button>",
          "(props, context) => props.hidden ? null : <><button data-viewport={context.viewport} disabled={props.disabled}>{props.label}</button><i></i></>",
        )
        .replaceAll(
          '<action.Component moklyInstance="footer" label="Finish" /><i></i>',
          '<action.Component moklyInstance="footer" label="Finish" />',
        ),
    source,
  );
  const result = await assertFastPathEquivalent(reviewFixture(fixture));

  assert.deepEqual(reasonKinds(result, "home"), ["material"]);
});

test("invocation line shifts alone keep every view on the fast path", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => "\n\n" + source);
  const reader = (outputs: ReadonlyMap<string, string>) => ({
    read: async (route: string) => {
      const content = outputs.get(route);
      assert.notEqual(content, undefined, route);
      return Buffer.from(content!);
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
  assert.deepEqual(counts, { views, fastPath: views, completePath: 0 });
});

function reviewFixture(
  fixture: Awaited<ReturnType<typeof componentReviewFixture>>,
): FastPathFixture {
  return {
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before),
    afterFiles: compilationFiles(fixture.after),
    changedPaths: fixture.changedPaths,
    config: fixture.config,
  };
}

function reasonKinds(result: ReviewResultV5, id: string) {
  const change = result.changes.find(
    (entry) => (entry.after ?? entry.before)?.id === id,
  );
  assert.ok(change);
  return change.reasons.map((reason) => reason.kind);
}
