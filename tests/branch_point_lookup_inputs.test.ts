import assert from "node:assert/strict";
import test from "node:test";

import { branchPoints } from "../packages/viewer/src/catalogue/branch_point.js";
import { readCurrentPath } from "../packages/viewer/src/catalogue/path_values.js";
import { pairMoves } from "../src/review/moves/pair.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupScreen,
} from "./helpers/branch_point_lookup.js";
import { moveEntry, moveSignals } from "./helpers/move_entries.js";

test("move candidates cannot pair a previous path that remains current in the same kind", () => {
  for (const path of ["Old", "old"])
    assert.deepEqual(
      pairMoves(
        [moveEntry("Old")],
        [moveEntry(path), moveEntry("new")],
        moveSignals({ identical: () => true }),
      ),
      { moves: [], diagnostics: [] },
    );
});

test("usage names resolve component parents on their explicit side", () => {
  const moved = lookupComponent("ui/badge");
  const renamed = lookupComponent("library/pill");
  const removed = { entry: lookupComponent("old"), folderTitles: [] };
  const variant = {
    ...lookupComponent("ui/badge/variant"),
    variantOf: moved.path,
  };
  const lookup = branchPoints(
    lookupCatalogue(
      [moved, renamed, variant, lookupScreen("screen")],
      [removed],
      [{ path: moved.path, previousPath: "library/badge" }],
    ),
  );
  assert.equal(
    lookup.usageComponent(readCurrentPath("LIBRARY/BADGE"), "before")?.entry,
    moved,
  );
  assert.equal(
    lookup.usageComponent(readCurrentPath("library/badge"), "after"),
    undefined,
  );
  for (const side of ["before", "after"] as const)
    assert.equal(
      lookup.usageComponent(readCurrentPath("library/Pill"), side)?.entry,
      renamed,
    );
  assert.deepEqual(lookup.usageComponent(readCurrentPath("old"), "before"), {
    source: "removed",
    entry: removed.entry,
    record: removed,
  });
  for (const name of ["old", "ui/badge/variant", "screen", "missing"])
    assert.equal(
      lookup.usageComponent(readCurrentPath(name), "after"),
      undefined,
    );
  assert.equal(
    lookup.usageComponent(readCurrentPath(variant.path), "before"),
    undefined,
  );
});
