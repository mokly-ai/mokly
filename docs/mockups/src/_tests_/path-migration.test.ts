import assert from "node:assert/strict";
import test from "node:test";

import { isEntryPath } from "@mokly/viewer/data";

import { catalogueEntries, catalogueIndex } from "./catalogue-index";
import mapping from "./fixtures/path-migration.json";

test("every earlier entry has its exact file-derived path and variant slug", () => {
  const index = catalogueIndex();
  assert.equal(index.schemaVersion, 9);
  const entries = new Map(
    catalogueEntries(index).map((entry) => [entry.path, entry]),
  );
  // `design/skeleton/comments` drew the three bars that the placeholder forms
  // replaced, so it left the catalogue with them. `design/site/pricing` left
  // with the site's pricing page.
  assert.equal(new Set(mapping.map(({ oldId }) => oldId)).size, 275);
  for (const expected of mapping) {
    assert.ok(isEntryPath(expected.path), expected.path);
    const entry = entries.get(expected.path);
    assert.ok(entry, expected.oldId);
    assert.equal(entry.kind, expected.kind, expected.path);
    assert.equal(entry.details.sourcePath, expected.module, expected.path);
    assert.equal(
      "variantOf" in entry ? entry.variantOf : undefined,
      "parent" in expected ? expected.parent : undefined,
    );
    assert.ok(!("id" in entry) && !("navPath" in entry), expected.path);
  }
});
