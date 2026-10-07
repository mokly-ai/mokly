import assert from "node:assert/strict";
import test from "node:test";

import type { ReviewResultV6 } from "../packages/viewer/dist/review/component_types.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

function changedRoutes(result: ReviewResultV6): string[] {
  return result.changes.map((entry) => (entry.after ?? entry.before)!.path);
}

test("an actual-only component rule changes the component and affects its screen", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.actual-only{color:red}</style>",
    "<style>.actual-only{color:blue}</style>",
  );
  const live = await fixture.live();
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.deepEqual(changedRoutes(result), ["action"]);
  assert.deepEqual(live.changedEntries, ["action"]);
  assert.ok(
    result.affectedConsumers.some(
      (consumer) =>
        consumer.changedComponentId === "action" &&
        consumer.consumer.kind === "screen" &&
        consumer.consumer.path === "home",
    ),
  );
  const home = result.screens.find((screen) => screen.path === "home")!;
  assert.ok(home.views.every((view) => view.state === "changed"));
  assert.ok(home.views.every((view) => !view.reasons));
  assert.ok(home.views.every((view) => !view.inlineStyles));
});

test("one rule shared by two components changes both and affects the screen", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.shared{color:red}</style>",
    "<style>.shared{color:blue}</style>",
  );
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.deepEqual(changedRoutes(result), ["action", "pane"]);
  assert.deepEqual(
    [
      ...new Set(
        result.affectedConsumers.map((item) => item.changedComponentId),
      ),
    ],
    ["action", "pane"],
  );
  assert.ok(
    result.screens
      .find((screen) => screen.path === "home")!
      .views.every(
        (view) =>
          view.state === "changed" && !view.reasons && !view.inlineStyles,
      ),
  );
});

for (const [name, selector, evidence] of [
  ["entry markup", ".entry", { status: "matched", selectors: [".entry"] }],
  [
    "an unresolved construct",
    ":root",
    { status: "unresolved", selectors: [":root"] },
  ],
  [
    "caller-owned markup inside a slot",
    ".slot-content",
    { status: "matched", selectors: [".slot-content"] },
  ],
] as const)
  test(`${name} remains a direct screen change`, async (t) => {
    const fixture = await inlineChangesFixture(
      t,
      `<style>${selector}{color:red}</style>`,
      `<style>${selector}{color:blue}</style>`,
    );
    const live = await fixture.live();
    const { result } = await fixture.complete();
    assert.equal(result.schemaVersion, 6);
    if (result.schemaVersion !== 6) return;
    assert.ok(changedRoutes(result).includes("home"));
    assert.ok(live.changedEntries?.includes("home"));
    const home = result.changes.find((entry) => entry.after?.path === "home");
    assert.ok(home?.reasons.some((reason) => reason.kind === "material"));
    assert.ok(
      result.screens
        .find((screen) => screen.path === "home")!
        .views.every(
          (view) =>
            JSON.stringify(view.inlineStyles) === JSON.stringify(evidence),
        ),
    );
  });

test("a nested component inside a caller slot owns its implementation rule", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.slot-child{color:red}</style>",
    "<style>.slot-child{color:blue}</style>",
  );
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.ok(changedRoutes(result).includes("action"));
  assert.ok(
    result.affectedConsumers.some(
      (item) =>
        item.changedComponentId === "action" &&
        item.consumer.kind === "screen" &&
        item.consumer.path === "home",
    ),
  );
});

test("the root component keeps its own matching style edit", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.action{color:red}</style>",
    "<style>.action{color:blue}</style>",
  );
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  const action = result.changes.find((entry) => entry.after?.path === "action");
  assert.ok(action?.reasons.some((reason) => reason.kind === "material"));
  assert.ok(
    result.components
      .find((component) => component.path === "action")!
      .variants.flatMap((variant) => variant.views)
      .every(
        (view) =>
          view.inlineStyles?.status === "matched" &&
          JSON.stringify(view.inlineStyles.selectors) ===
            JSON.stringify([".action"]),
      ),
  );
});
