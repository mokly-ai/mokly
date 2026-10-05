import assert from "node:assert/strict";
import test from "node:test";

import { branchPoints } from "../packages/viewer/src/catalogue/branch_point.js";
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
  const lookup = branchPoints(
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
  const lookup = branchPoints(lookupCatalogue([current]));
  assert.deepEqual(lookup.resolve({ side: "before", ...before }), {
    source: "current",
    entry: current,
  });
  assert.deepEqual(
    lookup.resolve({ side: "after", kind: "screen", path: "SHOP/RECEIPT" }),
    { source: "current", entry: current },
  );
  assert.deepEqual(lookup.counterpart(current, [before]), {
    kind: "screen",
    path: before.path,
  });
  assert.equal(lookup.baselineEntry(current, [before]), before);
  assert.equal(lookup.previousPath(current), undefined);
  assert.equal(
    lookup.resolve({ side: "before", kind: "document", path: before.path }),
    undefined,
  );
  assert.equal(lookup.counterpart(current), undefined);
  assert.equal(lookup.baselineEntry(current, []), undefined);
});

test("branch-point lookup retains removed records and never substitutes a different kind", () => {
  const record = {
    entry: lookupScreen("Old"),
    folderTitles: ["Archive"],
    snapshotId: "c".repeat(64),
  };
  const current = lookupComponent("receipt");
  const lookup = branchPoints(lookupCatalogue([current], [record]));
  const baseline = [lookupScreen("receipt")];
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
  assert.equal(lookup.counterpart(current, baseline), undefined);
  assert.equal(lookup.counterpart(record.entry, baseline), undefined);
  assert.equal(
    lookup.resolve({ side: "before", kind: "screen", path: "missing" }),
    undefined,
  );
});

test("a variant moving between parents uses its own counterpart", () => {
  const before = lookupScreen("donor/primary", "donor");
  const current = lookupScreen("receiver/primary", "receiver");
  const lookup = branchPoints(
    lookupCatalogue(
      [lookupScreen("donor"), lookupScreen("receiver"), current],
      [],
      [{ path: current.path, previousPath: before.path }],
    ),
  );
  const baseline = [lookupScreen("receiver"), before];
  assert.deepEqual(lookup.counterpart(current, baseline), {
    kind: "screen",
    path: before.path,
  });
  assert.deepEqual(lookup.counterpart(current), {
    kind: "screen",
    path: before.path,
  });
  assert.equal(lookup.baselineEntry(current, baseline), before);
  assert.equal(
    lookup.counterpart({ kind: "component", path: current.path }, baseline),
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
  const moved = branchPoints(catalogue);
  const plain = branchPoints(lookupCatalogue([current]));
  assert.equal(branchPoints(catalogue), moved, "one lookup per generation");
  assert.notEqual(plain, moved);
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
  assert.equal(lookup.usageComponent("LIBRARY/BADGE", "before")?.entry, moved);
  assert.equal(lookup.usageComponent("library/badge", "after"), undefined);
  for (const side of ["before", "after"] as const)
    assert.equal(lookup.usageComponent("library/Pill", side)?.entry, renamed);
  assert.deepEqual(lookup.usageComponent("old", "before"), {
    source: "removed",
    entry: removed.entry,
    record: removed,
  });
  for (const name of ["old", "ui/badge/variant", "screen", "missing"])
    assert.equal(lookup.usageComponent(name, "after"), undefined);
  assert.equal(lookup.usageComponent(variant.path, "before"), undefined);
});
