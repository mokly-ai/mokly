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

const noTitles = (): readonly string[] => [];
const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v6.json",
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
    screenPath: variant.path,
  });
  assert.equal(selected.screenPath, variant.path);
});

test("component parent and variant identities round trip through selection", () => {
  const component = fixture.components.find(
    (entry) => !("variantOf" in entry),
  )!;
  const variant = fixture.components.find((entry) => "variantOf" in entry)!;
  const current = normalizeSelection(fixture, {
    ...defaultSelection,
    screenPath: component.path,
  });
  const selectedVariant = mergeSelection(fixture, noTitles, current, {
    screenPath: variant.path,
  });
  assert.equal(selectedVariant.screenPath, variant.path);
  assert.equal(
    mergeSelection(fixture, noTitles, selectedVariant, {
      screenPath: component.path,
    }).screenPath,
    component.path,
  );
});

test("variant entry identity participates in equality and survives reveal", () => {
  const variant = fixture.components.find((entry) => "variantOf" in entry)!;
  const selected = normalizeSelection(fixture, {
    ...defaultSelection,
    screenPath: variant.path,
    search: "does-not-match",
  });
  assert.equal(
    sameSelection(selected, { ...selected, screenPath: null }),
    false,
  );
  assert.deepEqual(revealSelection(fixture, noTitles, selected), {
    ...selected,
    search: "",
  });
});

for (const [field, value] of Object.entries({
  screenPath: 1,
  view: "current",
  viewport: "tablet",
  colorScheme: "system",
  search: null,
  tags: ["two words"],
  variantPath: "components/action/default",
  unexpected: true,
}))
  test(`invalid ${field} selection is rejected`, () =>
    assert.throws(() =>
      normalizeSelection(fixture, { ...defaultSelection, [field]: value }),
    ));
