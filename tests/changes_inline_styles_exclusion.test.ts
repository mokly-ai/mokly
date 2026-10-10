import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

test("a cumulative sheet excludes another component's unused rule from a zero-instance screen", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.action{color:red}</style>",
    "<style>.action{color:red}.other-component{color:blue}</style>",
  );
  const live = await fixture.live();
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 7);
  if (result.schemaVersion !== 7) return;
  assert.deepEqual(result.changes, []);
  assert.deepEqual(live.changedEntries, []);
  const plain = result.screens.find((screen) => screen.path === "plain")!;
  assert.equal(plain.views.length, 4);
  assert.ok(
    plain.views.every(
      (view) =>
        view.state === "unchanged" &&
        !view.material &&
        !view.reasons &&
        !view.excludedResources &&
        view.inlineStyles?.status === "excluded",
    ),
  );
});

test("formatting, comments, attributes and element splits carry no identity", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    '<style nonce="before">.action { color: red; } .pane{display:block}</style>',
    '<style data-emotion="pane">/* moved */.pane { display: block }</style><style nonce="after">.action{color:red}</style>',
  );
  const live = await fixture.live();
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 7);
  if (result.schemaVersion !== 7) return;
  assert.deepEqual(result.changes, []);
  assert.deepEqual(live.changedEntries, []);
  assert.ok(
    [...result.screens, ...result.components].every(
      (entry) => entry.state === "unchanged",
    ),
  );
  assert.ok(
    result.screens.every((screen) =>
      screen.views.every((view) => !view.inlineStyles),
    ),
  );
});

test("a parse failure stays entry material with no inferred component owner", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.action{color:red}</style>",
    "<style>.action{color:blue</style>",
  );
  const live = await fixture.live();
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 7);
  if (result.schemaVersion !== 7) return;
  assert.ok(live.changedEntries?.includes("home"));
  assert.ok(
    result.changes.some(
      (entry) =>
        entry.after?.path === "home" &&
        entry.reasons.some((reason) => reason.kind === "material"),
    ),
  );
  assert.ok(
    result.screens
      .find((screen) => screen.path === "home")!
      .views.every(
        (view) =>
          view.inlineStyles?.status === "unresolved" &&
          view.inlineStyles.selectors.length === 0,
      ),
  );
});
