import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedIds } from "../dist/server/changed.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { componentScreenVariantEntrySource } from "./helpers/screen_variant_fixture.js";

for (const changed of ["parent", "variant"] as const)
  test(`component-aware flow propagation follows the exact changed screen: ${changed}`, async (t) => {
    const before = componentScreenVariantEntrySource({ flow: true });
    const after = componentScreenVariantEntrySource({
      flow: true,
      ...(changed === "parent"
        ? { parentText: "Changed parent" }
        : { variantText: "Changed variant" }),
    });
    const fixture = await componentReviewFixture(t, () => after, before);
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.equal(result.schemaVersion, 5);
    if (result.schemaVersion !== 5) return;
    const expected =
      changed === "variant" ? ["home-empty", "variant-flow"] : ["home"];

    assert.deepEqual(
      result.changes.map((entry) => (entry.after ?? entry.before)!.id),
      expected,
    );
    assert.deepEqual(
      await computeChangedIds(fixture.config, "main", fixture.git),
      expected,
    );
    const flow = result.changes.find((entry) => entry.kind === "use-case");
    if (changed === "parent") assert.equal(flow, undefined);
    else
      assert.deepEqual(flow?.reasons, [{ kind: "screen", id: "home-empty" }]);
  });

test("a variant consuming a changed component is an affected screen on its own route", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    (source) =>
      source.replace(
        "<button data-viewport=",
        '<button className="changed" data-viewport=',
      ),
    componentScreenVariantEntrySource(),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;

  assert.ok(
    result.affectedConsumers.some(
      ({ changedComponentId, consumer }) =>
        changedComponentId === "action" &&
        consumer.kind === "screen" &&
        consumer.id === "home-empty",
    ),
  );
});
