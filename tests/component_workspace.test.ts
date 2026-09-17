import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { catalogueAtBaseline } from "../dist/server/baseline_catalogue.js";
import { selectedVariant } from "../packages/viewer/dist/client/workspace_variants.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("workspace badges, comparison eligibility and usage use recorded evidence", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace("A shared action", "Updated action details"),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 3) assert.fail("Expected component result");
  const catalogue = createCatalogue(fixture.after.manifest);
  const entry = catalogue.byId.get("action");
  if (entry?.kind !== "component") assert.fail("Expected component");
  const context = {
    base: "main",
    updateVersion: 1,
    comparisons: true,
    componentChanges: { baseline: fixture.before.manifest, result },
  };
  const data = workspaceData(catalogue, context, entry);
  assert.equal(data.status, "Changed");
  assert.equal(data.comparisonEligible, true);
  assert.deepEqual(
    data.variants.map((item) => item.status),
    ["Unmodified", "Unmodified"],
  );
  assert.deepEqual(
    data.variants.map((item) => item.comparisonEligible),
    [false, false],
  );
  assert.equal(data.affected.length, 0);
  assert.equal(
    data.usedBy.filter((item) => item.route === "screens/home.html").length,
    16,
  );
  assert.equal(
    data.usedBy.filter((item) => item.route === "components/pane.html").length,
    4,
  );
  const defaultSelection = selectedVariant(data, "");
  assert.equal(defaultSelection.variant?.value.id, "default");
  assert.equal(defaultSelection.comparisonEligible, false);
  assert.ok(data.views.every((view) => view.usage));
  const live = workspaceData(
    catalogue,
    { ...context, previewGeneration: "live-generation" },
    entry,
  );
  assert.deepEqual(live.usedBy, data.usedBy);
  assert.equal(live.previewGeneration, "live-generation");
  assert.ok(live.views.every((view) => view.usage === undefined));
  assert.equal(
    selectedVariant(data, "?variant=disabled").variant?.value.id,
    "disabled",
  );
  assert.ok(selectedVariant(data, "?variant=disabled&variant=default").error);
  assert.ok(selectedVariant(data, "?variant=%2E%2E%2Fetc").error);
  assert.equal(
    workspaceData(catalogue, { base: "main", updateVersion: 1 }, entry).status,
    undefined,
  );
});

test("a renamed screen keeps distinct Added and Removed evidence in a component catalogue", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      'route: "screens/home.html"',
      'route: "screens/renamed.html"',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 3) assert.fail("Expected component result");
  const catalogue = catalogueAtBaseline(
    fixture.after.manifest,
    fixture.before.manifest,
  );
  const current = catalogue.byId.get("home");
  if (current?.kind !== "screen") assert.fail("Expected current screen");
  const context = {
    base: "main",
    updateVersion: 1,
    componentChanges: { baseline: fixture.before.manifest, result },
  };
  const after = workspaceData(catalogue, context, current);
  const before = workspaceData(
    catalogue,
    context,
    catalogue.removedScreens[0]!,
  );
  assert.equal(after.status, "Added");
  assert.equal(after.comparisonEligible, false);
  assert.equal(before.status, "Removed");
  assert.equal(before.comparisonEligible, false);
  assert.deepEqual(after.change?.reasons, [
    { kind: "added" },
    { kind: "material" },
  ]);
  assert.deepEqual(before.change?.reasons, [
    { kind: "material" },
    { kind: "removed" },
  ]);
});

test("a removed component variant retains its previous comparison", async (t) => {
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
  if (result.schemaVersion !== 3) assert.fail("Expected component result");
  const catalogue = createCatalogue(fixture.after.manifest);
  const entry = catalogue.byId.get("action");
  if (entry?.kind !== "component") assert.fail("Expected component");
  const data = workspaceData(
    catalogue,
    {
      base: "main",
      updateVersion: 1,
      comparisons: true,
      componentChanges: { baseline: fixture.before.manifest, result },
    },
    entry,
  );
  assert.equal(data.status, "Changed");
  assert.equal(data.comparisonEligible, true);
  assert.deepEqual(
    data.variants.map((variant) => [
      variant.value.id,
      variant.status,
      variant.comparisonEligible,
    ]),
    [
      ["default", "Unmodified", false],
      ["disabled", "Removed", true],
    ],
  );
  assert.equal(
    selectedVariant(data, "?variant=disabled").comparisonEligible,
    true,
  );
});
