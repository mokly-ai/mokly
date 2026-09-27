import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import { readCatalogue } from "../src/catalogue/reader.js";
import {
  defaultSelection,
  mergeSelection,
  normalizeSelection,
  revealSelection,
  sameSelection,
} from "../src/viewer/selection.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v3.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("selection normalizes mixed tag terms without mutating host values", () => {
  const supplied = {
    ...defaultSelection,
    search: "TAG:Forms details tag:forms",
    tags: ["FORMS", "Onboarding"],
  };
  const before = structuredClone(supplied);
  assert.deepEqual(normalizeSelection(fixture, supplied), {
    ...defaultSelection,
    search: "details",
    tags: ["forms", "onboarding"],
  });
  assert.deepEqual(supplied, before);
  assert.equal(
    sameSelection(defaultSelection, { ...defaultSelection, tags: [] }),
    true,
  );
});

test("selection validates saved variants without guessing another entry", () => {
  const component = fixture.components[0]!;
  const variantId = catalogueComponentVariants(fixture, component.id)[0]!.id;
  const selected = normalizeSelection(fixture, {
    ...defaultSelection,
    screenId: component.id,
    variantId,
  });
  assert.equal(selected.variantId, variantId);
  assert.throws(() =>
    normalizeSelection(fixture, {
      ...selected,
      variantId: "missing-variant",
    }),
  );
  assert.throws(() =>
    normalizeSelection(fixture, {
      ...defaultSelection,
      screenId: fixture.screens[0]!.id,
      variantId,
    }),
  );
});

test("screen changes drop omitted variants while explicit variants round trip", () => {
  const [component] = fixture.components;
  const variantId = catalogueComponentVariants(fixture, component!.id)[0]!.id;
  const current = normalizeSelection(fixture, {
    ...defaultSelection,
    screenId: component!.id,
    variantId,
  });
  const screen = mergeSelection(fixture, current, {
    screenId: fixture.screens[0]!.id,
  });
  assert.equal(screen.variantId, undefined);
  assert.equal(
    mergeSelection(fixture, screen, {
      screenId: component!.id,
      variantId,
    }).variantId,
    variantId,
  );
});

test("same-id current and historical components reset record-specific variants", () => {
  const current = fixture.components[0]!;
  const currentVariant = catalogueComponentVariants(fixture, current.id)[0]!;
  const historical = {
    ...structuredClone(current),
    route: "archive/action.html",
  };
  const historicalVariant = {
    ...structuredClone(currentVariant),
    id: "historical",
    route: "archive/historical.html",
    title: "Historical",
  };
  const snapshotId = "f".repeat(64);
  const model = {
    ...fixture,
    removedEntries: [
      ...fixture.removedEntries,
      { entry: historical, snapshotId },
      { entry: historicalVariant, snapshotId: "e".repeat(64) },
    ],
  };
  const currentSelection = normalizeSelection(model, {
    ...defaultSelection,
    screenId: current.id,
    variantId: currentVariant.id,
  });
  const selectedHistory = mergeSelection(model, currentSelection, {
    screenId: current.id,
    snapshotId,
  });
  assert.equal(selectedHistory.snapshotId, snapshotId);
  assert.equal(selectedHistory.variantId, undefined);

  const selectedHistoricalVariant = normalizeSelection(model, {
    ...selectedHistory,
    variantId: "historical",
  });
  const selectedCurrent = mergeSelection(model, selectedHistoricalVariant, {
    screenId: current.id,
  });
  assert.equal(selectedCurrent.snapshotId, undefined);
  assert.equal(selectedCurrent.variantId, undefined);
  assert.equal(
    mergeSelection(model, selectedHistoricalVariant, { viewport: "mobile" })
      .variantId,
    "historical",
  );
});

test("variant identity participates in equality and survives reveal", () => {
  const component = fixture.components[0]!;
  const variantId = catalogueComponentVariants(fixture, component.id)[0]!.id;
  const selected = normalizeSelection(fixture, {
    ...defaultSelection,
    screenId: component.id,
    variantId,
    search: "does-not-match",
  });
  assert.equal(
    sameSelection(selected, { ...selected, variantId: undefined }),
    false,
  );
  assert.deepEqual(revealSelection(fixture, selected), {
    ...selected,
    search: "",
  });
});

for (const [field, value] of Object.entries({
  screenId: 1,
  view: "current",
  viewport: "tablet",
  colorScheme: "system",
  search: null,
  tags: ["two words"],
  unexpected: true,
}))
  test(`invalid ${field} selection is rejected`, () =>
    assert.throws(() =>
      normalizeSelection(fixture, { ...defaultSelection, [field]: value }),
    ));
