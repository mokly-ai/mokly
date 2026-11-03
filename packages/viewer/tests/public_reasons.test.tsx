/** Details show the detail's reasons only for a record that Changes lists. */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { EntryChangeReason } from "../src/review/types.js";
import { shownReasons } from "../src/shell/public_reasons.js";

import { indexFixture, shellModelFixture } from "./catalogue_v9_fixture.js";

const HOME = "product/browse/home";
const ACTION = "components/action";

const every: EntryChangeReason[] = [
  { kind: "added" },
  { kind: "dependency", path: "static/a.css" },
  { kind: "implementation" },
  { kind: "inputs" },
  { kind: "material" },
  { kind: "metadata" },
  { kind: "removed" },
  { kind: "screen", screenPath: HOME },
  { kind: "structure" },
];

function record(
  index: CatalogueReadModel,
  path: string,
): ShellCatalogueRoutedEntry {
  const model = shellModelFixture(index);
  const found = [
    ...model.screens,
    ...model.components,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.removedEntries.map(({ entry }) => entry),
  ].find((entry) => entry.path === path);
  assert.ok(found, path);
  return found;
}

test("a record outside Changes, or a detail without reasons, shows none", () => {
  const index = indexFixture();
  assert.equal(shownReasons(record(index, ACTION), every), undefined);
  assert.equal(shownReasons(record(index, HOME), undefined), undefined);
  assert.deepEqual(shownReasons(record(index, HOME), []), []);
  assert.deepEqual(shownReasons(record(index, HOME), every), every);
});
