import assert from "node:assert/strict";
import test from "node:test";

import {
  branchPoints,
  type EntryIdentity,
} from "../packages/viewer/src/shell/catalogue_branch_point.js";
import { pairMoves } from "../src/review/moves/pair.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupComponentVariant,
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

test("moved variants are the current variants that left one former parent", () => {
  const action = lookupComponent("library/action");
  const kept = lookupComponentVariant("library/action/default", action.path);
  const quiet = lookupComponentVariant("library/action/quiet", action.path);
  const donor = lookupComponent("library/donor");
  const spare = lookupComponentVariant("library/donor/spare", donor.path);
  const receipt = lookupScreen("shop/receipt");
  const paid = lookupScreen("shop/receipt/paid", receipt.path);
  const toolbar = lookupComponent("library/toolbar");
  const inline = lookupComponentVariant("library/toolbar/inline", toolbar.path);
  const lent = lookupComponentVariant("library/toolbar/lent", toolbar.path);
  const lookup = branchPoints(
    lookupCatalogue(
      [action, kept, quiet, donor, spare, receipt, paid, toolbar, inline, lent],
      [],
      [
        { path: quiet.path, previousPath: "Link-Button/quiet" },
        { path: paid.path, previousPath: "link-button/paid" },
        { path: toolbar.path, previousPath: "library/bar" },
        { path: inline.path, previousPath: "link-button/Inline" },
        { path: lent.path, previousPath: "library/donor/lent" },
      ],
    ),
  );
  const moved = (parent: EntryIdentity) =>
    lookup.movedVariants(parent).map(({ path }) => path);
  for (const path of ["link-button", "LINK-BUTTON"])
    assert.deepEqual(moved({ kind: "component", path }), [
      quiet.path,
      inline.path,
    ]);
  assert.deepEqual(moved({ kind: "screen", path: "link-button" }), [paid.path]);
  assert.deepEqual(moved({ kind: "component", path: donor.path }), [lent.path]);
  assert.deepEqual(moved({ kind: "component", path: "library" }), []);
  assert.deepEqual(moved({ kind: "component", path: "library/bar" }), []);
  assert.deepEqual(moved({ kind: "component", path: action.path }), []);
});
