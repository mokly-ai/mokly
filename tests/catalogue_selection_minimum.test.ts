/** Reject invalid minimum counts without allowing empty selections. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogueSelectionError,
  entriesUnder,
  entriesWhere,
} from "./helpers/catalogue_selection.js";
import { screen } from "./helpers/catalogue_selection_fixture.js";

function invalidMinimum(action: () => unknown, helper: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof CatalogueSelectionError);
    assert.ok(error.message.startsWith(`${helper}:`), error.message);
    assert.ok(
      error.message.endsWith("; min must be a positive integer"),
      error.message,
    );
    return true;
  });
}

for (const [name, min] of [
  ["zero", 0],
  ["negative", -1],
  ["fractional", 0.5],
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["negative Infinity", -Infinity],
  ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
] as const) {
  test(`entriesUnder rejects a ${name} min`, () => {
    for (const entries of [[], [screen]])
      invalidMinimum(
        () => entriesUnder({ entries }, "design/components", { min }),
        "entriesUnder",
      );
  });

  test(`entriesWhere rejects a ${name} min`, () => {
    for (const entries of [[], [screen]])
      invalidMinimum(
        () => entriesWhere({ entries }, "screen entries", () => true, { min }),
        "entriesWhere",
      );
  });
}

test("selection helpers accept a positive safe minimum", () => {
  assert.deepEqual(
    entriesUnder({ entries: [screen] }, "design/components", { min: 1 }),
    [screen],
  );
  assert.deepEqual(
    entriesWhere({ entries: [screen] }, "screen entries", () => true, {
      min: 1,
    }),
    [screen],
  );
});

test("entriesUnder accepts the largest safe integer and checks its count", () => {
  assert.throws(
    () =>
      entriesUnder({ entries: [screen] }, "design/components", {
        min: Number.MAX_SAFE_INTEGER,
      }),
    {
      name: "CatalogueSelectionError",
      message: /expected at least 9007199254740991 entries/u,
    },
  );
});

test("entriesWhere accepts the largest safe integer and checks its count", () => {
  assert.throws(
    () =>
      entriesWhere({ entries: [screen] }, "screen entries", () => true, {
        min: Number.MAX_SAFE_INTEGER,
      }),
    {
      name: "CatalogueSelectionError",
      message: /expected at least 9007199254740991 entries/u,
    },
  );
});
