import assert from "node:assert/strict";
import test from "node:test";

import { createBranchPointLookup } from "../packages/viewer/src/shell/catalogue_branch_point.js";
import { pairMoves } from "../src/review/moves/pair.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupScreen,
} from "./helpers/branch_point_lookup.js";
import { moveEntry, moveSignals } from "./helpers/move_entries.js";

test("branch-point lookup follows accepted pairs by kind and preserves current spelling", () => {
  const current = lookupScreen("shop/archive/Receipt");
  const replacement = lookupComponent("shop/receipt");
  const lookup = createBranchPointLookup(
    lookupCatalogue(
      [current, replacement],
      [],
      [{ path: current.path, previousPath: "shop/receipt" }],
    ),
  );
  assert.deepEqual(
    lookup.resolve({ side: "before", kind: "screen", path: "SHOP/RECEIPT" }),
    { source: "current", entry: current },
  );
  assert.deepEqual(
    lookup.resolve({ side: "after", kind: "component", path: "shop/receipt" }),
    { source: "current", entry: replacement },
  );
  assert.equal(
    lookup.resolve({ side: "after", kind: "screen", path: "shop/receipt" }),
    undefined,
  );
  assert.deepEqual(lookup.counterpart(current), {
    kind: "screen",
    path: "shop/receipt",
  });
  assert.equal(lookup.previousPath(current), "shop/receipt");
  assert.equal(lookup.previousPath(replacement), undefined);
});

test("case-only identities use the same kind and preserve both sides without a move", () => {
  const current = lookupScreen("shop/receipt");
  const before = lookupScreen("shop/Receipt");
  const lookup = createBranchPointLookup(lookupCatalogue([current]), [before]);
  assert.deepEqual(lookup.resolve({ side: "before", ...before }), {
    source: "current",
    entry: current,
  });
  assert.deepEqual(
    lookup.resolve({ side: "after", kind: "screen", path: "SHOP/RECEIPT" }),
    { source: "current", entry: current },
  );
  assert.deepEqual(lookup.counterpart(current), {
    kind: "screen",
    path: before.path,
  });
  assert.equal(lookup.previousPath(current), undefined);
  assert.equal(
    lookup.resolve({ side: "before", kind: "document", path: before.path }),
    undefined,
  );
  assert.equal(
    createBranchPointLookup(lookupCatalogue([current])).counterpart(current),
    undefined,
  );
});

test("branch-point lookup retains removed records and never substitutes a different kind", () => {
  const record = {
    entry: lookupScreen("Old"),
    folderTitles: ["Archive"],
    snapshotId: "c".repeat(64),
  };
  const current = lookupComponent("receipt");
  const lookup = createBranchPointLookup(lookupCatalogue([current], [record]), [
    lookupScreen("receipt"),
  ]);
  assert.deepEqual(
    lookup.resolve({ side: "before", kind: "screen", path: "old" }),
    { source: "removed", entry: record.entry, record },
  );
  assert.equal(
    lookup.resolve({ side: "after", kind: "screen", path: "Old" }),
    undefined,
  );
  assert.equal(
    lookup.resolve({ side: "before", kind: "screen", path: current.path }),
    undefined,
  );
  assert.equal(lookup.counterpart(current), undefined);
  assert.equal(lookup.counterpart(record.entry), undefined);
  assert.equal(
    lookup.resolve({ side: "before", kind: "screen", path: "missing" }),
    undefined,
  );
});

test("a variant moving between parents uses its own counterpart", () => {
  const before = lookupScreen("donor/primary", "donor");
  const current = lookupScreen("receiver/primary", "receiver");
  const lookup = createBranchPointLookup(
    lookupCatalogue(
      [lookupScreen("donor"), lookupScreen("receiver"), current],
      [],
      [{ path: current.path, previousPath: before.path }],
    ),
    [lookupScreen("receiver"), before],
  );
  assert.deepEqual(lookup.counterpart(current), {
    kind: "screen",
    path: before.path,
  });
  assert.equal(
    lookup.counterpart({ kind: "component", path: current.path }),
    undefined,
  );
});

test("the lookup never changes inputs or leaks identities across generations", () => {
  const current = lookupScreen("new");
  const catalogue = lookupCatalogue(
    [current],
    [],
    [{ path: "new", previousPath: "old" }],
  );
  const before = structuredClone(catalogue);
  const moved = createBranchPointLookup(catalogue);
  const plain = createBranchPointLookup(lookupCatalogue([current]));
  assert.equal(
    moved.resolve({ side: "before", kind: "screen", path: "old" })?.entry,
    current,
  );
  assert.equal(
    plain.resolve({ side: "before", kind: "screen", path: "old" }),
    undefined,
  );
  assert.equal(plain.previousPath(current), undefined);
  assert.deepEqual(catalogue, before);
});

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
