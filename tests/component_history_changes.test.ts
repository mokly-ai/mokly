import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

const unregistered = (body: string) =>
  componentEntrySource({ body, exports: "" }).replace(
    / {2}defineCollection\([^\n]+\),\n/,
    "",
  );

test("registering unrelated components does not add unchanged screens to Changes", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () => componentEntrySource({ body: "<p>Stable</p>" }),
    unregistered("<p>Stable</p>"),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 5) assert.fail("Expected component comparison");
  assert.ok(result.changes.every((entry) => entry.kind === "component"));
  assert.equal(result.screens[0]?.state, "unchanged");
});

test("one-sided registration retains real screen content edits", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () =>
      componentEntrySource({
        body: "<pane.Component><p>After adoption</p></pane.Component>",
      }),
    unregistered("<p>Before adoption</p>"),
  );
  assert.equal(fixture.before.manifest.schemaVersion, 6);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  assert.ok(
    result.changes.some(
      (entry) =>
        entry.kind === "screen" &&
        entry.reasons.some((reason) => reason.kind === "material"),
    ),
  );
});

test("removed components retain variants, missing sides, and baseline consuming screens", async (t) => {
  const fixture = await componentReviewFixture(t, () =>
    unregistered("<p>Now standalone</p>"),
  );
  assert.equal(fixture.after.manifest.schemaVersion, 6);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  assert.equal(result.components.length, 2);
  assert.ok(
    result.components.every(
      (entry) =>
        entry.before &&
        !entry.after &&
        entry.state === "removed" &&
        entry.variants.every(
          (variant) =>
            variant.before &&
            !variant.after &&
            variant.views.every((view) => view.beforePath && !view.afterPath),
        ),
    ),
  );
  assert.ok(
    result.affectedConsumers.some(
      (entry) =>
        entry.consumer.kind === "screen" &&
        entry.evidence.every((evidence) => evidence.side === "before"),
    ),
  );
  assert.deepEqual(
    await computeChangedRoutes(fixture.config, "main", fixture.git),
    result.changes.map((entry) => (entry.after ?? entry.before)!.route),
  );
});

test("variant removal retains authored current order followed by explicit removed variants", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      ', { id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
      "",
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  const action = result.components.find((entry) => entry.id === "action")!;
  assert.deepEqual(
    action.variants.map((variant) => variant.id),
    ["default", "disabled"],
  );
  assert.equal(action.variants[1]!.state, "removed");
  assert.equal(action.after?.id, "action");
  assert.equal(result.changes.length, 1);
});

test("removed consumers retain their previous usage when a component changes", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source
      .replace(/ {2}defineScreen\([^\n]+\)\n/, "")
      .replace(
        "<button data-viewport=",
        '<button className="changed" data-viewport=',
      ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  const removed = result.screens.find((screen) => screen.id === "home")!;
  assert.equal(removed.state, "removed");
  assert.ok(
    result.affectedConsumers.some(
      (entry) =>
        entry.consumer.kind === "screen" &&
        entry.consumer.route === removed.route &&
        entry.evidence.every((evidence) => evidence.side === "before"),
    ),
  );
});

for (const edit of ["component", "screen"] as const)
  test(`only direct screen edits propagate to use cases: ${edit}`, async (t) => {
    const source = componentEntrySource()
      .replace("defineComponent,", "defineComponent, defineUseCase,")
      .replace('id: "home",', 'id: "home", useCaseIds: ["flow"],')
      .replace(
        "\n];",
        ',\n defineUseCase({ ...metadata, id: "flow", title: "Flow", description: "A screen sequence", route: "user-flows/home.html", steps: [{ screenId: "home" }] })\n];',
      );
    const fixture = await componentReviewFixture(
      t,
      (source) =>
        edit === "component"
          ? source.replace(
              "<button data-viewport=",
              '<button className="changed" data-viewport=',
            )
          : source.replaceAll(
              'label="Hidden" hidden',
              'label="Changed input" hidden',
            ),
      source,
    );
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.equal(result.schemaVersion, 5);
    if (result.schemaVersion !== 5) return;
    const flow = result.changes.find((entry) => entry.kind === "use-case");
    if (edit === "component") assert.equal(flow, undefined);
    else
      assert.deepEqual(flow?.reasons, [
        { kind: "screen", route: "screens/home.html" },
      ]);
    assert.deepEqual(
      await computeChangedRoutes(fixture.config, "main", fixture.git),
      result.changes.map((entry) => (entry.after ?? entry.before)!.route),
    );
  });
