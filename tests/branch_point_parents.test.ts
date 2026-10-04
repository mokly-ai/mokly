import assert from "node:assert/strict";
import test from "node:test";

import { createBranchPointLookup } from "../packages/viewer/src/shell/catalogue_branch_point.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupScreen,
} from "./helpers/branch_point_lookup.js";

for (const mode of ["move", "case"] as const) {
  test(`a removed variant resolves its ${mode} parent and a current variant stays current`, () => {
    const parent = lookupScreen(mode === "move" ? "new" : "OLD");
    const child = lookupScreen(`${parent.path}/kept`, parent.path);
    const record = {
      entry: lookupScreen("old/gone", "old"),
      folderTitles: [],
      parentTitle: "Former title",
    };
    const moves =
      mode === "move" ? [{ path: parent.path, previousPath: "old" }] : [];
    const lookup = createBranchPointLookup(
      lookupCatalogue([parent, child], [record], moves),
    );
    assert.deepEqual(
      lookup.parent({ source: "removed", entry: record.entry, record }),
      { source: "current", entry: parent },
    );
    assert.deepEqual(lookup.parent({ source: "current", entry: child }), {
      source: "current",
      entry: parent,
    });
    assert.equal(
      lookup.parent({ source: "current", entry: parent }),
      undefined,
    );
    if (mode === "move")
      assert.equal(
        lookup.parent({
          source: "current",
          entry: lookupScreen("old/live", "old"),
        }),
        undefined,
      );
  });
}

test("a variant can resolve a same-kind removed parent", () => {
  const parent = {
    entry: lookupScreen("old"),
    folderTitles: [],
    snapshotId: "a".repeat(64),
  };
  const variant = {
    entry: lookupScreen("old/gone", "old"),
    folderTitles: [],
    parentTitle: "Former title",
  };
  const lookup = createBranchPointLookup(
    lookupCatalogue([], [parent, variant]),
  );
  assert.deepEqual(
    lookup.parent({ source: "removed", entry: variant.entry, record: variant }),
    { source: "removed", entry: parent.entry, record: parent },
  );
});

for (const mode of [
  "absent",
  "another-kind",
  "variant",
  "removed-variant",
] as const) {
  test(`a ${mode} parent gives a removed variant its stored title without a destination`, () => {
    const child = {
      entry: lookupScreen("old/gone", "old"),
      folderTitles: [],
      parentTitle: "Former screen title",
    };
    const other =
      mode === "another-kind"
        ? lookupComponent("old")
        : lookupScreen("old", "container");
    const entries =
      mode === "absent" || mode === "removed-variant" ? [] : [other];
    const removed =
      mode === "removed-variant"
        ? [child, { entry: other, parentTitle: "Container", folderTitles: [] }]
        : [child];
    const lookup = createBranchPointLookup(lookupCatalogue(entries, removed));
    assert.deepEqual(
      lookup.parent({ source: "removed", entry: child.entry, record: child }),
      { source: "title", title: "Former screen title" },
    );
  });
}
