import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReviewResultV3 } from "../dist/review/component_types.js";

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

function reasonKinds(result: ReviewResultV3, id: string) {
  const change = result.changes.find(
    (entry) => (entry.after ?? entry.before)?.id === id,
  );
  assert.ok(change);
  return change.reasons.map((reason) => reason.kind);
}
