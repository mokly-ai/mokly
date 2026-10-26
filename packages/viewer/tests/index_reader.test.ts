import assert from "node:assert/strict";
import { test } from "node:test";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import {
  MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../src/catalogue/version_error.js";

import { rawIndexFixture } from "./catalogue_v8_fixture.js";

const HASH = "a".repeat(64);

function rejects(
  edit: (index: Record<string, unknown>) => void,
  reason: RegExp,
): void {
  const raw = rawIndexFixture() as unknown as Record<string, unknown>;
  edit(raw);
  assert.throws(
    () => readCatalogueIndex(raw),
    (error) =>
      !(error instanceof MoklyVersionError) &&
      error instanceof Error &&
      reason.test(error.message),
  );
}

function screens(raw: Record<string, unknown>) {
  return (raw as unknown as CatalogueReadModel).screens as unknown as Record<
    string,
    unknown
  >[];
}

test("the index reader accepts the v7 fixture field for field", () => {
  const raw = rawIndexFixture();
  const index = readCatalogueIndex(structuredClone(raw));
  assert.equal(index.schemaVersion, 8);
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
});

test("the version gate runs before any other field is read", () => {
  for (const value of [
    undefined,
    null,
    "8",
    7,
    [],
    {},
    { schemaVersion: 6 },
    { schemaVersion: 9, tree: "not a tree" },
    { schemaVersion: "8" },
    { ...rawIndexFixture(), schemaVersion: 6 },
  ])
    assert.throws(
      () => readCatalogueIndex(value),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "catalogue" &&
        error.supported === 8 &&
        error.code === "unsupported-mokly-version",
    );
  assert.equal(
    VERSION_ERROR_MESSAGE,
    "This catalogue needs a compatible viewer",
  );
});

test("no index record carries usage or resource evidence", () => {
  rejects((raw) => {
    const view = (screens(raw)[0]!.views as Record<string, unknown>[])[0]!;
    view.usage = { status: "pending" };
  }, /usage is not public catalogue data/);
  rejects((raw) => {
    const view = (screens(raw)[0]!.views as Record<string, unknown>[])[0]!;
    view.resourceEvidence = { rules: [], resources: [] };
  }, /resourceEvidence is not public catalogue data/);
  rejects((raw) => {
    const page = (raw.pages as Record<string, unknown>[])[0]!;
    page.resourceEvidence = { rules: [], resources: [] };
  }, /resourceEvidence is not public catalogue data/);
  rejects((raw) => {
    const removed = (raw.removedEntries as Record<string, unknown>[])[0]!;
    (removed.entry as Record<string, unknown>).usage = { status: "omitted" };
  }, /usage is not public catalogue data/);
});

test("private evidence keys are rejected anywhere in the index", () => {
  for (const key of ["sourceFiles", "token", "renderCapability", "manifest"])
    rejects(
      (raw) => {
        (screens(raw)[0]!.details as Record<string, unknown>)[key] = [];
      },
      new RegExp(`${key} is not public catalogue data`),
    );
});

test("identity, deployment, revision and live are exact", () => {
  rejects((raw) => {
    raw.deploymentId = "abc";
  }, /invalid identity/);
  rejects((raw) => {
    raw.revision = -1;
  }, /nonnegative safe integer/);
  rejects((raw) => {
    raw.revision = 1.5;
  }, /nonnegative safe integer/);
  rejects((raw) => {
    (raw.identity as Record<string, unknown>).title = "Other";
  }, /catalogue title must be Mokly/);
  rejects((raw) => {
    raw.live = { generation: "x" };
  }, /invalid identity/);
  const live = readCatalogueIndex({
    ...rawIndexFixture(),
    live: { generation: HASH },
    revision: 4,
  });
  assert.deepEqual(live.live, { generation: HASH });
  assert.equal(live.revision, 4);
});

test("every view and document carries a document key", () => {
  rejects((raw) => {
    const view = (screens(raw)[0]!.views as Record<string, unknown>[])[0]!;
    delete view.documentKey;
  }, /expected a string/);
  rejects((raw) => {
    const page = (raw.pages as Record<string, unknown>[])[0]!;
    page.documentKey = "short";
  }, /invalid identity/);
  rejects((raw) => {
    const document = (raw.documents as Record<string, unknown>[])[0]!;
    document.documentKeys = [];
  }, /document keys must follow its schemes/);
});

test("removed records pin their snapshot and preview while a comparison is published", () => {
  rejects((raw) => {
    const removed = (raw.removedEntries as Record<string, unknown>[])[0]!;
    delete removed.snapshotId;
  }, /needs snapshotId when comparisonUrl is non-null/);
  rejects((raw) => {
    const removed = (raw.removedEntries as Record<string, unknown>[])[0]!;
    removed.preview = { kind: "document" };
  }, /preview kind must match entry/);
  rejects((raw) => {
    raw.changesStatus = "unavailable";
    delete raw.baseCommit;
    raw.removedEntries = [];
    for (const field of [
      "screens",
      "pages",
      "documents",
      "useCases",
      "components",
    ])
      for (const entry of raw[field] as Record<string, unknown>[]) {
        entry.changes = { status: "unavailable" };
        delete entry.previousPath;
        for (const view of (entry.views ?? []) as Record<string, unknown>[])
          view.comparison = { status: "unavailable" };
      }
  }, /incomplete evidence cannot pin comparisons or removals/);
});

test("current paths are unique and cannot collide with removed paths", () => {
  rejects((raw) => {
    screens(raw)[1]!.path = screens(raw)[0]!.path;
  }, /duplicate reference/);
  rejects((raw) => {
    const removed = (raw.removedEntries as Record<string, unknown>[])[0]!;
    (removed.entry as Record<string, unknown>).path = "guide";
  }, /current and removed entries cannot share a path/);
});

test("the comparison URL is a generation path, or null without previews", () => {
  rejects((raw) => {
    delete raw.comparisonUrl;
  }, /expected a string/);
  rejects((raw) => {
    raw.comparisonUrl = "https://elsewhere.test/review.json";
  }, /invalid comparison path/);
  rejects((raw) => {
    raw.comparisonUrl = `/${String(raw.comparisonUrl)}`;
  }, /invalid comparison path/);
  rejects((raw) => {
    raw.comparisonUrl = null;
  }, /preview requires comparison URL/);
  const unpublished = rawIndexFixture();
  unpublished.comparisonUrl = null;
  for (const removed of unpublished.removedEntries) delete removed.preview;
  assert.equal(readCatalogueIndex(unpublished).comparisonUrl, null);
});

test("the base commit belongs exactly to ready Changes and the comparison names a root", () => {
  assert.equal(
    readCatalogueIndex(rawIndexFixture()).baseCommit,
    "b".repeat(40),
  );
  rejects((raw) => {
    delete raw.baseCommit;
  }, /baseCommit belongs exactly to ready Changes/);
  rejects((raw) => {
    raw.baseCommit = "B".repeat(40);
  }, /invalid base commit/);
  rejects((raw) => {
    raw.changesStatus = "pending";
  }, /baseCommit belongs exactly to ready Changes/);
  rejects((raw) => {
    raw.comparisonUrl = `${String(raw.comparisonUrl)}review.json`;
  }, /invalid comparison path/);
});
