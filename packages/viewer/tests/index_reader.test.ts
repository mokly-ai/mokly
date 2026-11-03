import assert from "node:assert/strict";
import { test } from "node:test";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import {
  MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../src/catalogue/version_error.js";

import { rawIndexFixture } from "./catalogue_v9_fixture.js";

const HASH = "a".repeat(64);

test("the index reader accepts the protocol fixture field for field", () => {
  const raw = rawIndexFixture();
  const index = readCatalogueIndex(raw);
  assert.deepEqual(index, raw);
  assert.notStrictEqual(index, raw);
  assert.notStrictEqual(index.identity, raw.identity);
  assert.notStrictEqual(index.screens[0]!.views, raw.screens[0]!.views);
  assert.equal(index.schemaVersion, 9);
  assert.deepEqual(index.identity, raw.identity);
  assert.equal(index.deploymentId, raw.deploymentId);
  assert.equal(index.revision, 0);
  assert.equal(index.live, undefined);
  assert.deepEqual(
    index.screens.map((screen) => screen.path),
    raw.screens.map((screen) => screen.path),
  );
  assert.deepEqual(
    index.screens[0]!.views.map((view) => view.documentKey),
    raw.screens[0]!.views.map((view) => view.documentKey),
  );
  assert.deepEqual(
    index.removedEntries.map((removed) => removed.snapshotId),
    raw.removedEntries.map((removed) => removed.snapshotId),
  );
  const live = readCatalogueIndex({
    ...rawIndexFixture(),
    live: { generation: HASH },
    revision: 4,
  });
  assert.deepEqual(live.live, { generation: HASH });
  assert.equal(live.revision, 4);
  const unpublished = rawIndexFixture();
  unpublished.comparisonUrl = null;
  for (const removed of unpublished.removedEntries) delete removed.preview;
  assert.equal(readCatalogueIndex(unpublished).comparisonUrl, null);
  assert.equal(
    readCatalogueIndex(rawIndexFixture()).baseCommit,
    "b".repeat(40),
  );
});

test("the version gate runs before any other field is read", () => {
  for (const value of [
    undefined,
    null,
    "9",
    7,
    [],
    {},
    { schemaVersion: 6 },
    { schemaVersion: 8 },
    { schemaVersion: 10, tree: "not a tree" },
    { schemaVersion: "9" },
    { ...rawIndexFixture(), schemaVersion: 6 },
    { ...rawIndexFixture(), schemaVersion: 8 },
  ])
    assert.throws(
      () => readCatalogueIndex(value),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "catalogue" &&
        error.supported === 9 &&
        error.code === "unsupported-mokly-version",
    );
  assert.equal(
    VERSION_ERROR_MESSAGE,
    "This catalogue needs a compatible viewer",
  );
});
