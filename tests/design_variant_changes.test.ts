import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  textContent,
} from "./helpers/design_catalogue.js";
import {
  filterTargets,
  rowLabel,
  rowLabels,
  variantToggles,
} from "./helpers/design_rows.js";

test("Changes shows the changed variant row and marks its parent", async () => {
  const { document } = await designDocument(
    "design/browse/variants/variant-changes",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), [
    "Example",
    "Screens",
    "Welcome",
    "Save failed",
  ]);
  assert.equal(byClass(document, "mbk-nav-changed").length, 2);
  assert.deepEqual(
    byClass(document, "mbk-nav-changed-text").map((node) =>
      textContent(node).trim(),
    ),
    ["Changed", "Changed"],
  );
  const toggles = variantToggles(document);
  assert.equal(toggles.length, 1);
  assert.equal(attribute(toggles[0]!, "aria-expanded"), "true");
  const rows = byClass(document, "mbk-nav-row");
  const parent = rows.find((row) => rowLabel(row) === "Welcome");
  assert.equal(
    attribute(parent!, "data-mokly-link"),
    "design/browse/variants/variant-changes",
    "the parent opens its first changed variant",
  );
  assert.equal(attribute(parent!, "aria-current"), undefined);
  const variant = rows.find((row) => rowLabel(row) === "Save failed");
  assert.equal(attribute(variant!, "class"), "mbk-nav-row active");
  assert.deepEqual(filterTargets(document), [
    ["All", "design/browse/variants/variant-selected"],
  ]);
});

test("a removed variant stays under its surviving parent", async () => {
  const { document } = await designDocument(
    "design/browse/variants/variant-removed",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), [
    "Example",
    "Screens",
    "Welcome",
    "Save failed · Removed",
  ]);
  assert.equal(byClass(document, "mbk-nav-changed").length, 1);
  const rows = byClass(document, "mbk-nav-row");
  assert.equal(
    attribute(
      rows.find((row) => rowLabel(row) === "Save failed · Removed")!,
      "class",
    ),
    "mbk-nav-row active",
  );
  assert.deepEqual(filterTargets(document), [
    ["All", "design/browse/views/screen"],
  ]);
});

test("a change confined to other views keeps the parent row closed", async () => {
  const { document } = await designDocument(
    "design/browse/variants/changed-views",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), ["Example", "Screens", "Welcome"]);
  const toggles = variantToggles(document);
  assert.equal(toggles.length, 1);
  assert.equal(attribute(toggles[0]!, "aria-expanded"), "false");
  assert.equal(byClass(document, "mbk-nav-changed").length, 1);
  assert.deepEqual(filterTargets(document), [
    ["All", "design/browse/views/screen"],
  ]);
});
