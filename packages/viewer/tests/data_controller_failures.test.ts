import assert from "node:assert/strict";
import { test } from "node:test";

import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import {
  initialSnapshot,
  shellStateWithCatalogue,
} from "../src/shell/data_commit.js";
import { ShellDataController } from "../src/shell/data_controller.js";
import { shellContext } from "../src/shell/projection.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { defaultSelection } from "../src/shell/selection.js";
import { createInitialShellState } from "../src/shell/store_initial.js";

import { detailFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { FakeDataSource, flush } from "./data_fakes.js";

const GENERATION = "2".repeat(64);

function liveIndex(revision = 0) {
  return indexFixture((index) => {
    index.revision = revision;
    index.live = { generation: GENERATION };
  });
}

test("an unreadable refresh route notifies one catalogue failure without changing the snapshot", async () => {
  const index = liveIndex();
  const fixture = controllerFixture(index, {
    live: true,
    path: "/view/product/browse/home/",
  });
  const initial = fixture.controller.snapshot;
  let changes = 0;
  fixture.controller.subscribe(() => changes++);
  fixture.controller.connect();
  fixture.live.listener!.message(1, index.deploymentId);
  fixture.source
    .index()
    .resolve(readCatalogueIndex({ ...liveIndex(1), screens: null }));
  await flush();
  assert.equal(fixture.controller.failure?.error instanceof TypeError, true);
  assert.equal(changes, 1);
  assert.equal(fixture.controller.snapshot, initial);
  assert.equal(fixture.controller.refreshFailed, undefined);
  assert.deepEqual(fixture.commits, []);
});

test("an unreadable refresh projection notifies one catalogue failure without changing the snapshot", async () => {
  const index = liveIndex();
  const fixture = controllerFixture(index, { live: true });
  const initial = fixture.controller.snapshot;
  let changes = 0;
  fixture.controller.subscribe(() => changes++);
  fixture.controller.connect();
  fixture.live.listener!.message(1, index.deploymentId);
  const published = liveIndex(1);
  fixture.source.index().resolve(
    readCatalogueIndex({
      ...published,
      screens: published.screens.map((screen) => ({ ...screen, views: null })),
    }),
  );
  await flush();
  assert.equal(fixture.controller.failure?.error instanceof TypeError, true);
  assert.equal(changes, 1);
  assert.equal(fixture.controller.snapshot, initial);
  assert.equal(fixture.controller.refreshFailed, undefined);
  assert.deepEqual(fixture.commits, []);
});

test("a refresh that fails shell state preparation keeps the installed snapshot and notifies its failure", async () => {
  const index = liveIndex();
  const initial = initialSnapshot(index);
  const route = routeFromUrl(
    initial.catalogue,
    new URL("/", "https://catalogue.test"),
  );
  const state = createInitialShellState(
    initial.catalogue,
    shellContext(initial.catalogue.publicModel, defaultSelection),
    route,
    undefined,
  );
  const source = new FakeDataSource(true);
  let commits = 0;
  const controller = new ShellDataController(initial, source, {
    prepare(next) {
      shellStateWithCatalogue(state, next.catalogue);
      return () => commits++;
    },
    route: () => route,
    versionError() {},
    warn() {},
  });
  let changes = 0;
  controller.subscribe(() => changes++);
  controller.connect();
  source.live!.listener!.message(1, index.deploymentId);
  const published = liveIndex(1);
  source.index().resolve(
    readCatalogueIndex({
      ...published,
      pages: published.pages.map((page) => ({ ...page, previousPath: null })),
    }),
  );
  await flush();
  assert.equal(controller.failure?.error instanceof TypeError, true);
  assert.equal(changes, 1);
  assert.equal(controller.snapshot, initial);
  assert.equal(commits, 0);
});

test("a malformed detail from an abandoned route does not fail its replacement", async () => {
  const fixture = controllerFixture(indexFixture());
  const path = "product/browse/home";
  fixture.navigate(`/view/${path}/`);
  const abandoned = fixture.source.detail(path);
  fixture.navigate("/view/guide/");
  assert.equal(abandoned.signal.aborted, true);
  abandoned.resolve(
    readEntryDetail({ ...detailFixture({ path }), identity: null }),
  );
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  assert.equal(fixture.controller.failure, undefined);
  assert.equal(fixture.commits.length, 1);
  assert.deepEqual(fixture.source.detailFailures, []);
});

test("a malformed refresh that a newer publication aborted does not fail its replacement", async () => {
  const index = liveIndex();
  const path = "product/browse/home";
  const fixture = controllerFixture(index, {
    live: true,
    path: `/view/${path}/`,
  });
  fixture.controller.connect();
  fixture.live.listener!.message(1, index.deploymentId);
  const abandoned = fixture.source.index();
  fixture.live.listener!.message(2, index.deploymentId);
  assert.equal(abandoned.signal.aborted, true);
  abandoned.resolve(readCatalogueIndex({ ...liveIndex(1), screens: null }));
  const published = liveIndex(2);
  fixture.source.index().resolve(published);
  await flush();
  assert.equal(fixture.controller.failure, undefined);
  fixture.source
    .detail(path)
    .resolve({ ...detailFixture({ path }), revision: 2 });
  await flush();
  assert.equal(fixture.controller.failure, undefined);
  assert.equal(fixture.controller.snapshot.index, published);
  assert.equal(fixture.commits.length, 1);
});

test("a state commit exception reaches its caller unchanged", () => {
  const index = indexFixture();
  const path = "product/browse/home";
  const initial = initialSnapshot(index, [[{ path }, detailFixture({ path })]]);
  const route = routeFromUrl(
    initial.catalogue,
    new URL(`/view/${path}/`, "https://catalogue.test"),
  );
  const error = new Error("Host state commit failed");
  const controller = new ShellDataController(initial, new FakeDataSource(), {
    prepare: () => () => {
      throw error;
    },
    route: () => route,
    versionError() {},
    warn() {},
  });
  assert.throws(
    () => controller.reload([{ path }]),
    (received) => received === error,
  );
  assert.equal(controller.failure, undefined);
});

test("a deployment check aborted by a catalogue failure reports no later replacement", async () => {
  const fixture = controllerFixture(indexFixture(), { static: true });
  fixture.navigate("/view/guide/");
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  const path = "product/browse/home";
  fixture.navigate(`/view/${path}/`);
  const deployment = fixture.source.deployment();
  fixture.source
    .detail(path)
    .resolve(readEntryDetail({ ...detailFixture({ path }), identity: null }));
  await flush();
  assert.equal(fixture.controller.failure?.error instanceof TypeError, true);
  assert.equal(deployment.signal.aborted, true);
  deployment.resolve({ schemaVersion: 1, deploymentId: "f".repeat(64) });
  await flush();
  assert.equal(fixture.source.deploymentChanges, 0);
});
