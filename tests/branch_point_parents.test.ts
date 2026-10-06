import assert from "node:assert/strict";
import test from "node:test";

import { branchPoints } from "../packages/viewer/src/catalogue/branch_point.js";
import { readCurrentPath } from "../packages/viewer/src/catalogue/path_values.js";
import {
  currentIdentityFixture,
  currentManifestEntryFixture,
  removedManifestEntryFixture,
} from "../packages/viewer/tests/manifest_path_fixture.js";

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
      entry: removedManifestEntryFixture(lookupScreen("old/gone", "old")),
      folderTitles: [],
      parentTitle: "Former title",
    };
    const moves =
      mode === "move" ? [{ path: parent.path, previousPath: "old" }] : [];
    const lookup = branchPoints(
      lookupCatalogue([parent, child], [record], moves),
    );
    assert.deepEqual(
      lookup.parent({
        source: "removed",
        entry: removedManifestEntryFixture(record.entry),
        record,
      }),
      { source: "current", entry: parent },
    );
    assert.deepEqual(
      lookup.parent({
        source: "current",
        entry: currentManifestEntryFixture(child),
      }),
      {
        source: "current",
        entry: parent,
      },
    );
    assert.equal(
      lookup.parent({
        source: "current",
        entry: currentManifestEntryFixture(parent),
      }),
      undefined,
    );
    if (mode === "move")
      assert.equal(
        lookup.parent({
          source: "current",
          entry: currentManifestEntryFixture(lookupScreen("old/live", "old")),
        }),
        undefined,
      );
  });
}

test("a variant can resolve a same-kind removed parent", () => {
  const parent = {
    entry: removedManifestEntryFixture(lookupScreen("old")),
    folderTitles: [],
    snapshotId: "a".repeat(64),
  };
  const variant = {
    entry: removedManifestEntryFixture(lookupScreen("old/gone", "old")),
    folderTitles: [],
    parentTitle: "Former title",
  };
  const lookup = branchPoints(lookupCatalogue([], [parent, variant]));
  assert.deepEqual(
    lookup.parent({
      source: "removed",
      entry: removedManifestEntryFixture(variant.entry),
      record: variant,
    }),
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
      entry: removedManifestEntryFixture(lookupScreen("old/gone", "old")),
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
    const lookup = branchPoints(lookupCatalogue(entries, removed));
    assert.deepEqual(
      lookup.parent({
        source: "removed",
        entry: removedManifestEntryFixture(child.entry),
        record: child,
      }),
      { source: "title", title: "Former screen title" },
    );
  });
}

test("removed variants attach to the parent the lookup resolves, in record order", () => {
  for (const mode of ["move", "case"] as const) {
    const parent = lookupScreen(mode === "move" ? "new" : "OLD");
    const records = ["old/first", "old/second"].map((path) => ({
      entry: removedManifestEntryFixture(lookupScreen(path, "old")),
      folderTitles: [],
      parentTitle: "Former title",
    }));
    const moves =
      mode === "move" ? [{ path: parent.path, previousPath: "old" }] : [];
    const lookup = branchPoints(lookupCatalogue([parent], records, moves));
    assert.deepEqual(
      lookup.removedVariants(currentIdentityFixture(parent)),
      records,
      mode,
    );
    assert.deepEqual(
      lookup.removedVariants({
        kind: "component",
        path: readCurrentPath(parent.path),
      }),
      [],
      `${mode}: another kind adopts nothing`,
    );
    for (const record of records)
      assert.deepEqual(
        lookup.parentOf(currentIdentityFixture(record.entry)),
        { source: "current", entry: parent },
        mode,
      );
    assert.equal(
      lookup.parentOf(currentIdentityFixture(parent)),
      undefined,
      `${mode}: a parent`,
    );
  }
});

test("a variant without an eligible parent is adopted by nothing", () => {
  const child = {
    entry: removedManifestEntryFixture(lookupScreen("old/gone", "old")),
    folderTitles: [],
    parentTitle: "Former screen title",
  };
  const replacement = lookupComponent("old");
  const lookup = branchPoints(lookupCatalogue([replacement], [child]));
  assert.deepEqual(lookup.parentOf(currentIdentityFixture(child.entry)), {
    source: "title",
    title: "Former screen title",
  });
  assert.deepEqual(
    lookup.removedVariants(currentIdentityFixture(replacement)),
    [],
  );
  assert.deepEqual(
    lookup.removedVariants({ kind: "screen", path: readCurrentPath("old") }),
    [],
  );
});
