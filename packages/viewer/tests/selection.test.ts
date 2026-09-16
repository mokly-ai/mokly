import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultSelection,
  normalizeSelection,
  sameSelection,
} from "../src/viewer/selection.js";

test("selection normalizes mixed tag terms without mutating host values", () => {
  const supplied = {
    ...defaultSelection,
    search: "TAG:Forms details tag:forms",
    tags: ["FORMS", "Onboarding"],
  };
  const before = structuredClone(supplied);
  assert.deepEqual(normalizeSelection(supplied), {
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
      normalizeSelection({ ...defaultSelection, [field]: value }),
    ));
