import assert from "node:assert/strict";
import { test } from "node:test";

import { removedManifestEntries } from "../packages/mokly/dist/registry/changes.js";
import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { catalogueAtBaseline } from "../packages/mokly/dist/server/baseline_catalogue.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { selectedVariant } from "../packages/viewer/dist/shell/workspace_selection.js";

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
  if (result.schemaVersion !== 5) assert.fail("Expected component result");
  const catalogue = createCatalogue(
    fixture.after.manifest,
    removedManifestEntries(fixture.after.manifest, fixture.before.manifest),
  );
  const entry = catalogue.byPath.get("action");
  if (entry?.kind !== "component" || "variantOf" in entry)
    assert.fail("Expected component");
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
    data.usedBy.filter((item) => item.entryId === "home").length,
    16,
  );
  assert.equal(
    data.usedBy.filter((item) => item.entryId === "pane/default").length,
    4,
  );
  const defaultSelection = selectedVariant(data);
  assert.equal(defaultSelection.variant?.value.path, "action/default");
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
  const disabled = catalogue.byPath.get("action/disabled");
  if (disabled?.kind !== "component" || !("variantOf" in disabled))
    assert.fail("Expected component variant");
  const disabledData = workspaceData(catalogue, context, disabled);
  assert.equal(
    selectedVariant(disabledData).variant?.value.path,
    disabled.path,
  );
  assert.equal(
    workspaceData(catalogue, { base: "main", updateVersion: 1 }, entry).status,
    undefined,
  );
});

test("unrelated screens retain distinct Added and Removed evidence in a component catalogue", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source
      .replace(
        'path: "home", title: "Home"',
        'path: "renamed", title: "Another screen"',
      )
      .replaceAll("<main>", "<aside>")
      .replaceAll("</main>", "</aside>"),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 5) assert.fail("Expected component result");
  const catalogue = catalogueAtBaseline(
    fixture.after.manifest,
    fixture.before.manifest,
  );
  const current = catalogue.byPath.get("renamed");
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
      ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
      "",
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 5) assert.fail("Expected component result");
  const catalogue = createCatalogue(
    fixture.after.manifest,
    removedManifestEntries(fixture.after.manifest, fixture.before.manifest),
  );
  const entry = catalogue.byPath.get("action");
  if (entry?.kind !== "component" || "variantOf" in entry)
    assert.fail("Expected component");
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
  assert.equal(data.status, "Unmodified");
  assert.equal(data.comparisonEligible, false);
  assert.deepEqual(
    data.variants.map((variant) => [
      variant.value.path,
      variant.status,
      variant.comparisonEligible,
    ]),
    [
      ["action/default", "Unmodified", false],
      ["action/disabled", "Removed", true],
    ],
  );
  assert.equal(
    selectedVariant(
      workspaceData(
        catalogue,
        {
          base: "main",
          updateVersion: 1,
          comparisons: true,
          componentChanges: { baseline: fixture.before.manifest, result },
        },
        catalogue.removedEntries.find(
          ({ entry }) => entry.path === "action/disabled",
        )!.entry as Parameters<typeof workspaceData>[2],
      ),
    ).comparisonEligible,
    true,
  );
});
