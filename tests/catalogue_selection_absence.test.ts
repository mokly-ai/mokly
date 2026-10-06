/** Check absence assertions against live catalogue anchors. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAbsent,
  CatalogueSelectionError,
} from "./helpers/catalogue_selection.js";
import { manifest, screen } from "./helpers/catalogue_selection_fixture.js";

function selectionError(action: () => unknown, ...details: string[]): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof CatalogueSelectionError);
    assert.equal(error.name, "CatalogueSelectionError");
    for (const detail of details)
      assert.ok(error.message.includes(detail), error.message);
    return true;
  });
}

test("assertAbsent raises AssertionError for a present path", () => {
  assert.throws(
    () => assertAbsent(manifest, screen.path),
    assert.AssertionError,
  );
});

test("assertAbsent accepts an absent path under a live anchor", () => {
  assert.equal(assertAbsent(manifest, "design/components/missing"), undefined);
});

test("assertAbsent rejects a dead anchor without matching sibling prefixes", () => {
  selectionError(
    () => assertAbsent(manifest, "design/component/missing"),
    "assertAbsent",
    "design/component",
    "matches=0",
  );
});

test("assertAbsent uses a top-level path as its own anchor", () => {
  assert.equal(assertAbsent(manifest, "design"), undefined);
  selectionError(
    () => assertAbsent(manifest, "missing"),
    "assertAbsent",
    "missing",
    "matches=0",
  );
});
