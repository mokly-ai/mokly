import assert from "node:assert/strict";
import test from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import type { CatalogueComponentVariant } from "../src/catalogue/types.js";
import { resolveCatalogueUsageScope } from "../src/catalogue/usage_scope.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

test("case-renamed parents retain current and removed variants through both spellings", () => {
  const model = structuredClone(scopedCatalogueFixture());
  const parent = model.components.find((entry) => !("variantOf" in entry))!;
  const old = parent.path;
  parent.path = "components/Action";
  for (const entry of model.components) {
    if (!("variantOf" in entry) || entry.variantOf !== old) continue;
    entry.path = entry.path.replace(old, parent.path);
    entry.variantOf = parent.path;
  }
  const expected = ["components/Action/default", "components/action/retired"];
  for (const name of [old, parent.path])
    assert.deepEqual(
      catalogueComponentVariants(model, name).map((entry) => entry.path),
      expected,
    );
  const variant = model.removedEntries.find(
    ({ entry }) => entry.path === expected[1],
  )!.entry;
  const target = {
    kind: "target",
    entryPath: variant.path,
    entryKind: variant.kind,
  } as const;
  assert.deepEqual(
    [...resolveCatalogueUsageScope(model, target)],
    catalogueComponentVariants(model, parent.path).flatMap(
      (entry) => entry.views,
    ),
  );
});

test("a removed variant without an eligible parent retains only its own usage", () => {
  const model = structuredClone(scopedCatalogueFixture());
  const record = model.removedEntries.find(
    ({ entry }) => entry.path === "components/action/retired",
  )!;
  const variant = record.entry as CatalogueComponentVariant;
  variant.path = "absent/retired";
  variant.variantOf = "absent";
  const target = {
    kind: "target",
    entryPath: variant.path,
    entryKind: variant.kind,
  } as const;
  assert.deepEqual(
    [...resolveCatalogueUsageScope(model, target)],
    variant.views,
  );
  assert.deepEqual(catalogueComponentVariants(model, variant.path), [variant]);
  assert.deepEqual(catalogueComponentVariants(model, variant.variantOf), []);
});
