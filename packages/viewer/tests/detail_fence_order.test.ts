import assert from "node:assert/strict";
import { test } from "node:test";

import { fenceDetail } from "../src/catalogue/detail_fences.js";
import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../src/catalogue/types.js";
import { loadFencedDetail } from "../src/shell/data_requests.js";
import type { ShellDataSource } from "../src/shell/data_source.js";

import { indexFixture, rawDetailFixtures } from "./catalogue_v9_fixture.js";

const HOME = "product/browse/home";
const OTHER = "b2".repeat(32);

/** Each light view followed by its dark twin, in the index's axis order. */
function withDark<T extends { colorScheme: string }>(
  views: readonly T[],
  dark: (view: T) => T,
): T[] {
  return views.flatMap((view) => [view, dark(view)]);
}

/** Home's detail at a revision, optionally with dark views. */
function home(revision: number, dark = false): EntryDetailV4 {
  const detail = rawDetailFixtures().current[HOME]!;
  detail.revision = revision;
  if (dark)
    detail.views = withDark(detail.views, (view) => ({
      ...structuredClone(view),
      colorScheme: "dark",
    }));
  return readEntryDetail(detail);
}

/** The index at a revision, optionally with home's dark views. */
function index(revision: number, dark = false): CatalogueReadModel {
  return indexFixture((raw) => {
    raw.revision = revision;
    if (!dark) return;
    const screen = raw.screens.find((entry) => entry.path === HOME)!;
    screen.colorSchemes = ["light", "dark"];
    screen.views = withDark(screen.views, (view) => ({
      ...structuredClone(view),
      colorScheme: "dark",
      documentKey: OTHER,
    }));
  });
}

test("a newer detail is a revision mismatch before its content is compared", () => {
  assert.equal(
    fenceDetail(index(0), { path: HOME }, home(1, true)).kind,
    "revision",
  );
  assert.equal(
    fenceDetail(index(1, true), { path: HOME }, home(1, true)).kind,
    "accepted",
  );
  assert.equal(
    fenceDetail(index(1), { path: HOME }, home(1, true)).kind,
    "rejected",
  );
});

test("a newer detail with changed views installs with the refetched index", async () => {
  const refetched = index(1, true);
  let refetches = 0;
  const source: ShellDataSource = {
    loadIndex: async () => {
      refetches += 1;
      return refetched;
    },
    loadDetail: async () => home(1, true),
    deploymentChanged() {},
  };
  const outcome = await loadFencedDetail(
    source,
    index(0),
    { path: HOME },
    new AbortController().signal,
  );
  assert.equal(refetches, 1);
  assert.equal(outcome.kind, "accepted");
  assert.equal(outcome.kind === "accepted" && outcome.index, refetched);
});

test("another deployment wins over another identity", () => {
  const detail = rawDetailFixtures().current[HOME]!;
  detail.detailId = OTHER;
  detail.identity = { ...detail.identity, id: OTHER };
  assert.deepEqual(
    fenceDetail(index(0), { path: HOME }, readEntryDetail(detail)),
    { kind: "deployment" },
  );
});
