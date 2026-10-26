import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import type { ShellCatalogueScreen } from "../src/catalogue/scoped_types.js";
import {
  dataSnapshot,
  initialSnapshot,
  shellStateWithCatalogue,
  withDetails,
  withIndex,
} from "../src/shell/data_commit.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import {
  detailFixture,
  detailPairs,
  indexFixture,
} from "./catalogue_v8_fixture.js";

const OTHER = "f".repeat(64);
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";
const HOME = "product/browse/home";

function screen(snapshot: ReturnType<typeof dataSnapshot>, path: string) {
  return snapshot.catalogue.publicModel.screens.find(
    (entry) => entry.path === path,
  ) as ShellCatalogueScreen;
}

function state(snapshot: ReturnType<typeof dataSnapshot>, path: string) {
  const model = snapshot.catalogue.publicModel;
  return createInitialShellState(
    snapshot.catalogue,
    viewerContext(model, defaultSelection),
    routeFromUrl(snapshot.catalogue, new URL(path, "https://catalogue.test")),
    undefined,
  );
}

test("the first snapshot holds only the details its fences accept", () => {
  const index = indexFixture();
  const snapshot = initialSnapshot(index, [
    [{ path: HOME }, detailFixture({ path: HOME })],
    [{ path: "guide" }, { ...detailFixture({ path: "guide" }), revision: 9 }],
    [{ path: "product" }, detailFixture({ path: "guide" })],
  ]);
  assert.deepEqual([...snapshot.details.keys()], [detailKey({ path: HOME })]);
  assert.equal(screen(snapshot, HOME).views[0]!.usage.status, "ready");
  assert.equal(
    screen(snapshot, "product/browse/details").views[0]!.usage.status,
    "omitted",
  );
});

test("an accepted detail adds its usage without replacing the index", () => {
  const empty = dataSnapshot(indexFixture(), new Map());
  assert.equal(screen(empty, HOME).views[0]!.usage.status, "omitted");
  const next = withDetails(empty, [
    [{ path: HOME }, detailFixture({ path: HOME })],
  ]);
  assert.equal(next.index, empty.index);
  assert.equal(screen(next, HOME).views[0]!.usage.status, "ready");
  assert.equal(empty.details.size, 0);
});

test("a newer index keeps only the details of its own revision", () => {
  const held = initialSnapshot(indexFixture(), detailPairs());
  const newer = indexFixture((raw) => (raw.revision = 1));
  const next = withIndex(held, newer, [
    [{ path: HOME }, { ...detailFixture({ path: HOME }), revision: 1 }],
  ]);
  assert.equal(next.index, newer);
  assert.deepEqual(
    [...next.details.keys()].sort(),
    [
      detailKey({ path: HOME }),
      ...detailPairs()
        .filter(([request]) => request.snapshotId !== undefined)
        .map(([request]) => detailKey(request)),
    ].sort(),
  );
  assert.equal(
    screen(next, "product/browse/details").views[0]!.usage.status,
    "omitted",
  );
});

test("removed details stay only while their comparison stays", () => {
  const held = initialSnapshot(indexFixture(), detailPairs());
  const key = detailKey({
    path: "product/browse/home/retired",
    snapshotId: RETIRED,
  });
  const same = withIndex(
    held,
    indexFixture((raw) => (raw.revision = 1)),
    [],
  );
  assert.ok(same.details.has(key));
  const replaced = withIndex(
    held,
    indexFixture((raw) => {
      raw.revision = 1;
      raw.comparisonUrl = `mokly-viewer/diffs/generations/${OTHER}/`;
    }),
    [],
  );
  assert.equal(replaced.details.has(key), false);
});

test("a publication rebinds the routed record and keeps interaction state", () => {
  const before = initialSnapshot(indexFixture(), detailPairs());
  const initial = state(before, `/view/${HOME}/`);
  const edited = {
    ...initial,
    query: "home",
    detailsOpen: true,
    disclosures: { ...initial.disclosures, "variants:components/action": true },
  };
  const after = withIndex(
    before,
    indexFixture((raw) => (raw.revision = 1)),
    [[{ path: HOME }, { ...detailFixture({ path: HOME }), revision: 1 }]],
  );
  const next = shellStateWithCatalogue(edited, after.catalogue);
  assert.equal(next.route.view.kind, "target");
  if (next.route.view.kind !== "target") return;
  assert.equal(next.route.view.target.entry.path, HOME);
  assert.equal(next.route.view.target.entry, after.catalogue.byPath.get(HOME));
  assert.equal(next.query, "home");
  assert.equal(next.detailsOpen, true);
  assert.equal(next.disclosures["variants:components/action"], true);
  assert.equal(next.changesStatus, "ready");
});

test("an entry the publication drops shows the missing state and keeps its URL", () => {
  const before = initialSnapshot(indexFixture(), detailPairs());
  const routed = state(before, "/view/guide/");
  const without = indexFixture((raw) => {
    raw.revision = 1;
    raw.pages = [];
    raw.tree = raw.tree.filter((node) => node.path !== "guide");
  });
  const next = shellStateWithCatalogue(
    routed,
    withIndex(before, without, []).catalogue,
  );
  assert.deepEqual(next.route.view, {
    kind: "missing",
    requested: "view/guide/",
  });
});

test("a missing route shows its entry again once a later publication lists it", () => {
  const before = initialSnapshot(indexFixture(), detailPairs());
  const routed = state(before, "/view/guide/");
  const dropped = withIndex(
    before,
    indexFixture((raw) => {
      raw.revision = 1;
      raw.pages = [];
      raw.tree = raw.tree.filter((node) => node.path !== "guide");
    }),
    [],
  );
  const missing = shellStateWithCatalogue(routed, dropped.catalogue);
  assert.equal(missing.route.view.kind, "missing");
  const restored = withIndex(
    dropped,
    indexFixture((raw) => {
      raw.revision = 2;
    }),
    [],
  );
  const returned = shellStateWithCatalogue(missing, restored.catalogue);
  assert.equal(returned.route.view.kind, "target");
  assert.equal(
    returned.route.view.kind === "target" &&
      returned.route.view.target.entry.path,
    "guide",
  );
  const unknown = state(before, "/view/nope/");
  assert.deepEqual(
    shellStateWithCatalogue(unknown, restored.catalogue).route.view,
    { kind: "missing", requested: "view/nope/" },
  );
});

test("a removed route turns missing when its snapshot record goes", () => {
  const before = initialSnapshot(indexFixture(), detailPairs());
  const routed = state(
    before,
    `/view/product/browse/home/retired/?snapshot=${RETIRED}`,
  );
  assert.equal(routed.route.view.kind, "target");
  const replaced = indexFixture((raw) => {
    raw.revision = 1;
    raw.removedEntries = raw.removedEntries.filter(
      (record) => record.snapshotId !== RETIRED,
    );
  });
  const next = shellStateWithCatalogue(
    routed,
    withIndex(before, replaced, []).catalogue,
  );
  assert.equal(next.route.view.kind, "missing");
  assert.equal(next.route.snapshot, RETIRED);
});
