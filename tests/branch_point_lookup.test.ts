import assert from "node:assert/strict";
import test from "node:test";

import { branchPoints } from "../packages/viewer/src/catalogue/branch_point.js";
import {
  readBranchPointPath,
  readCurrentPath,
} from "../packages/viewer/src/catalogue/path_values.js";
import {
  baselineIdentityFixture,
  baselineManifestEntryFixture,
  currentIdentityFixture,
} from "../packages/viewer/tests/manifest_path_fixture.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupScreen,
} from "./helpers/branch_point_lookup.js";

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
    lookup.resolve({
      side: "before",
      kind: "screen",
      path: readBranchPointPath("SHOP/RECEIPT"),
    }),
    { source: "current", entry: current },
  );
  assert.deepEqual(
    lookup.resolve({
      side: "after",
      kind: "component",
      path: readCurrentPath("shop/receipt"),
    }),
    { source: "current", entry: replacement },
  );
  assert.equal(
    lookup.resolve({
      side: "after",
      kind: "screen",
      path: readCurrentPath("shop/receipt"),
    }),
    undefined,
  );
  assert.deepEqual(lookup.counterpart(currentIdentityFixture(current)), {
    kind: "screen",
    path: "shop/receipt",
  });
  assert.equal(
    lookup.previousPath(currentIdentityFixture(current)),
    "shop/receipt",
  );
  assert.equal(
    lookup.previousPath(currentIdentityFixture(replacement)),
    undefined,
  );
});

test("case-only identities use the same kind and preserve both sides without a move", () => {
  const current = lookupScreen("shop/receipt");
  const before = lookupScreen("shop/Receipt");
  const lookup = branchPoints(lookupCatalogue([current]));
  assert.deepEqual(
    lookup.resolve(
      baselineIdentityFixture({ side: "before" as const, ...before }),
    ),
    {
      source: "current",
      entry: current,
    },
  );
  assert.deepEqual(
    lookup.resolve({
      side: "after",
      kind: "screen",
      path: readCurrentPath("SHOP/RECEIPT"),
    }),
    { source: "current", entry: current },
  );
  assert.deepEqual(
    lookup.counterpart(currentIdentityFixture(current), [
      baselineManifestEntryFixture(before),
    ]),
    {
      kind: "screen",
      path: before.path,
    },
  );
  assert.equal(
    lookup.baselineEntry(currentIdentityFixture(current), [
      baselineManifestEntryFixture(before),
    ]),
    before,
  );
  assert.equal(lookup.previousPath(currentIdentityFixture(current)), undefined);
  assert.equal(
    lookup.resolve({
      side: "before",
      kind: "document",
      path: readBranchPointPath(before.path),
    }),
    undefined,
  );
  assert.equal(lookup.counterpart(currentIdentityFixture(current)), undefined);
  assert.equal(
    lookup.baselineEntry(currentIdentityFixture(current), []),
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
  const lookup = branchPoints(lookupCatalogue([current], [record]));
  const baseline = [lookupScreen("receipt")];
  assert.deepEqual(
    lookup.resolve({
      side: "before",
      kind: "screen",
      path: readBranchPointPath("old"),
    }),
    { source: "removed", entry: record.entry, record },
  );
  assert.equal(
    lookup.resolve({
      side: "after",
      kind: "screen",
      path: readCurrentPath("Old"),
    }),
    undefined,
  );
  assert.equal(
    lookup.resolve({
      side: "before",
      kind: "screen",
      path: readBranchPointPath(current.path),
    }),
    undefined,
  );
  assert.equal(
    lookup.counterpart(
      currentIdentityFixture(current),
      baseline.map(baselineManifestEntryFixture),
    ),
    undefined,
  );
  assert.equal(
    lookup.counterpart(
      currentIdentityFixture(record.entry),
      baseline.map(baselineManifestEntryFixture),
    ),
    undefined,
  );
  assert.equal(
    lookup.resolve({
      side: "before",
      kind: "screen",
      path: readBranchPointPath("missing"),
    }),
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
  assert.deepEqual(
    lookup.counterpart(
      currentIdentityFixture(current),
      baseline.map(baselineManifestEntryFixture),
    ),
    {
      kind: "screen",
      path: before.path,
    },
  );
  assert.deepEqual(lookup.counterpart(currentIdentityFixture(current)), {
    kind: "screen",
    path: before.path,
  });
  assert.equal(
    lookup.baselineEntry(
      currentIdentityFixture(current),
      baseline.map(baselineManifestEntryFixture),
    ),
    before,
  );
  assert.equal(
    lookup.counterpart(
      { kind: "component", path: readCurrentPath(current.path) },
      baseline.map(baselineManifestEntryFixture),
    ),
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
    moved.resolve({
      side: "before",
      kind: "screen",
      path: readBranchPointPath("old"),
    })?.entry,
    current,
  );
  assert.equal(
    plain.resolve({
      side: "before",
      kind: "screen",
      path: readBranchPointPath("old"),
    }),
    undefined,
  );
  assert.equal(plain.previousPath(currentIdentityFixture(current)), undefined);
  assert.deepEqual(catalogue, before);
});
