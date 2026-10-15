import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import {
  initialSnapshot,
  shellStateWithCatalogue,
} from "../src/shell/data_commit.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { indexFixture } from "./catalogue_v7_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush } from "./data_fakes.js";

const GENERATION = "a1".repeat(32);
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";
const REMOVED_PATH = `/view/product/browse/home/retired/?snapshot=${RETIRED}`;

function live(edit?: (raw: CatalogueReadModel) => void, revision = 1) {
  return indexFixture((raw) => {
    raw.revision = revision;
    raw.live = { generation: GENERATION };
    edit?.(raw);
  });
}

/** The shell state on `path`, rebound to a committed publication. */
function stateAfter(
  index: CatalogueReadModel,
  path: string,
  published: CatalogueReadModel,
) {
  const before = initialSnapshot(index);
  const state = createInitialShellState(
    before.catalogue,
    viewerContext(before.catalogue.publicModel!, defaultSelection),
    routeFromUrl(before.catalogue, new URL(path, "https://catalogue.test")),
    undefined,
  );
  return shellStateWithCatalogue(state, initialSnapshot(published).catalogue);
}

/** Publish one index on a connected controller routed at `path`. */
async function publish(path: string, published: CatalogueReadModel) {
  const index = live();
  const fixture = controllerFixture(index, { live: true, path });
  fixture.controller.connect();
  fixture.live.listener!.message(published.revision, index.deploymentId);
  fixture.source.index().resolve(published);
  await flush();
  return { fixture, index };
}

test("a publication that drops the open entry installs and shows the missing state", async () => {
  const published = live((raw) => {
    raw.pages = [];
    raw.tree = raw.tree.filter((node) => node.path !== "guide");
  }, 2);
  const { fixture, index } = await publish("/view/guide/", published);
  assert.deepEqual(fixture.source.details, []);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.controller.snapshot.index, published);
  assert.equal(fixture.controller.refreshFailed, undefined);
  assert.deepEqual(stateAfter(index, "/view/guide/", published).route.view, {
    kind: "missing",
    requested: "view/guide/",
  });
});

test("a publication that renames the open entry installs and shows the missing state", async () => {
  const published = live((raw) => {
    const page = raw.pages[0]!;
    page.path = "manual";
    page.previousPath = "guide";
    page.changes = { status: "ready", kind: "unmodified", included: true };
    for (const node of raw.tree)
      if (node.path === "guide") node.path = "manual";
  }, 2);
  const { fixture, index } = await publish("/view/guide/", published);
  assert.deepEqual(fixture.source.details, []);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.controller.snapshot.index, published);
  assert.deepEqual(stateAfter(index, "/view/guide/", published).route.view, {
    kind: "missing",
    requested: "view/guide/",
  });
});

test("a publication that drops the open removed record installs and shows the missing state", async () => {
  const published = live((raw) => {
    raw.removedEntries = raw.removedEntries.filter(
      (record) => record.snapshotId !== RETIRED,
    );
  }, 2);
  const { fixture, index } = await publish(REMOVED_PATH, published);
  assert.deepEqual(fixture.source.details, []);
  assert.equal(fixture.commits.length, 1);
  const state = stateAfter(index, REMOVED_PATH, published);
  assert.equal(state.route.view.kind, "missing");
  assert.equal(state.route.snapshot, RETIRED);
});

test("a kept entry still loads its detail with the publication", async () => {
  const published = live(undefined, 2);
  const { fixture } = await publish("/view/guide/", published);
  assert.deepEqual(
    fixture.source.details.map((item) => item.input),
    [{ path: "guide" }],
  );
  assert.equal(fixture.commits.length, 0);
});
