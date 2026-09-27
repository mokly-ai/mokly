import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

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

test("selection addresses a component variant as an ordinary entry", () => {
  const variant = fixture.components.find((entry) => "variantOf" in entry)!;
  const selected = normalizeSelection(fixture, {
    ...defaultSelection,
    screenId: variant.id,
  });
  assert.equal(selected.screenId, variant.id);
});

test("component parent and variant identities round trip through selection", () => {
  const component = fixture.components.find(
    (entry) => !("variantOf" in entry),
  )!;
  const variant = fixture.components.find((entry) => "variantOf" in entry)!;
  const current = normalizeSelection(fixture, {
    ...defaultSelection,
    screenId: component.id,
  });
  const selectedVariant = mergeSelection(fixture, current, {
    screenId: variant.id,
  });
  assert.equal(selectedVariant.screenId, variant.id);
  assert.equal(
    mergeSelection(fixture, selectedVariant, { screenId: component.id })
      .screenId,
    component.id,
  );
});

test("same-id current and historical components reset record identity", () => {
  const current = fixture.components.find((entry) => !("variantOf" in entry))!;
  const historical = {
    ...structuredClone(current),
    route: "archive/action.html",
  };
  const snapshotId = "f".repeat(64);
  const model = {
    ...fixture,
    removedEntries: [
      ...fixture.removedEntries,
      { entry: historical, snapshotId },
    ],
  };
  const currentSelection = normalizeSelection(model, {
    ...defaultSelection,
    screenId: current.id,
  });
  const selectedHistory = mergeSelection(model, currentSelection, {
    screenId: current.id,
    snapshotId,
  });
  assert.equal(selectedHistory.snapshotId, snapshotId);
  const selectedCurrent = mergeSelection(model, selectedHistory, {
    screenId: current.id,
  });
  assert.equal(selectedCurrent.snapshotId, undefined);
});

test("variant entry identity participates in equality and survives reveal", () => {
  const variant = fixture.components.find((entry) => "variantOf" in entry)!;
  const selected = normalizeSelection(fixture, {
    ...defaultSelection,
    screenId: variant.id,
    search: "does-not-match",
  });
  assert.equal(sameSelection(selected, { ...selected, screenId: null }), false);
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
  variantId: "action-default",
  unexpected: true,
}))
  test(`invalid ${field} selection is rejected`, () =>
    assert.throws(() =>
      normalizeSelection(fixture, { ...defaultSelection, [field]: value }),
    ));
