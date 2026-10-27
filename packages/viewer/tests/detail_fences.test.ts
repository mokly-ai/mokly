import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey, fenceDetail } from "../src/catalogue/detail_fences.js";
import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import type { EntryDetailV3 } from "../src/catalogue/types.js";

import { indexFixture, rawDetailFixtures } from "./catalogue_v8_fixture.js";

const OTHER = "d".repeat(64);
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";
const REMOVED_PAGE =
  "ae7c43c42ac411cb914b0029a816886b912351c7f54ab79c6bb77f2122a1530c";

function current(
  path: string,
  edit?: (detail: EntryDetailV3) => void,
): EntryDetailV3 {
  const detail = rawDetailFixtures().current[path]!;
  edit?.(detail);
  return readEntryDetail(detail);
}

function removed(
  snapshotId: string,
  edit?: (detail: EntryDetailV3) => void,
): EntryDetailV3 {
  const detail = rawDetailFixtures().removed[snapshotId]!;
  edit?.(detail);
  return readEntryDetail(detail);
}

test("control order names exactly the index's editable props", () => {
  const index = indexFixture();
  const path = "components/action";
  for (const order of [[], ["missing"]]) {
    const detail = current(path, (detail) => {
      detail.controlOrder = order;
    });
    assert.equal(fenceDetail(index, { path }, detail).kind, "rejected");
  }
  assert.equal(fenceDetail(index, { path }, current(path)).kind, "accepted");
});

test("the fixture index accepts every fixture detail", () => {
  const index = indexFixture();
  const fixtures = rawDetailFixtures();
  for (const path of Object.keys(fixtures.current))
    assert.equal(
      fenceDetail(index, { path }, current(path)).kind,
      "accepted",
      path,
    );
  for (const [snapshotId, detail] of Object.entries(fixtures.removed))
    assert.equal(
      fenceDetail(
        index,
        { path: detail.entry.path, snapshotId },
        removed(snapshotId),
      ).kind,
      "accepted",
      snapshotId,
    );
});

test("detail keys separate current and removed requests", () => {
  assert.equal(detailKey({ path: "guide" }), "current:guide");
  assert.equal(
    detailKey({ path: "guide", snapshotId: OTHER }),
    `removed:${OTHER}:guide`,
  );
});

test("a current detail needs the index identity, detail id and revision", () => {
  const index = indexFixture();
  const request = { path: "product/browse/home" };
  const identity = current(request.path, (detail) => {
    (detail.identity as { id: string }).id = OTHER;
  });
  assert.deepEqual(fenceDetail(index, request, identity), {
    kind: "rejected",
  });
  const deployment = current(request.path, (detail) => {
    detail.detailId = OTHER;
  });
  assert.deepEqual(fenceDetail(index, request, deployment), {
    kind: "deployment",
  });
  const newer = current(request.path, (detail) => {
    detail.revision = 1;
  });
  assert.equal(fenceDetail(index, request, newer).kind, "revision");
  assert.equal(
    fenceDetail(
      indexFixture((raw) => (raw.revision = 1)),
      request,
      newer,
    ).kind,
    "accepted",
  );
});

test("a current detail must describe the requested index entry", () => {
  const index = indexFixture();
  assert.equal(
    fenceDetail(index, { path: "product/browse/details" }, current("guide"))
      .kind,
    "deployment",
  );
  assert.equal(
    fenceDetail(index, { path: "missing" }, current("guide")).kind,
    "rejected",
  );
  const lostView = current("product/browse/home", (detail) => {
    (detail.views as unknown[]).pop();
  });
  assert.equal(
    fenceDetail(index, { path: "product/browse/home" }, lostView).kind,
    "rejected",
  );
  assert.equal(
    fenceDetail(index, { path: "product/browse/home" }, removed(RETIRED)).kind,
    "revision",
  );
});

test("usage must fit the index's components and the entry kind", () => {
  const index = indexFixture();
  const noRoot = current("components/action", (detail) => {
    for (const view of detail.views)
      if (view.usage.status === "ready") view.usage.ranges = [];
  });
  assert.equal(
    fenceDetail(index, { path: "components/action" }, noRoot).kind,
    "rejected",
  );
  const screenRoot = current("product/browse/home", (detail) => {
    for (const view of detail.views)
      if (view.usage.status === "ready")
        view.usage.ranges = [{ id: "r-0", target: { kind: "root" } }];
  });
  assert.equal(
    fenceDetail(index, { path: "product/browse/home" }, screenRoot).kind,
    "rejected",
  );
  const pending = current("components/action", (detail) => {
    for (const view of detail.views)
      (view as { usage: unknown }).usage = { status: "pending" };
  });
  assert.equal(
    fenceDetail(index, { path: "components/action" }, pending).kind,
    "accepted",
  );
});

test("a removed detail needs the index identity, detail id and snapshot", () => {
  const index = indexFixture();
  const path = "product/browse/home/retired";
  assert.equal(
    fenceDetail(index, { path, snapshotId: RETIRED }, removed(RETIRED)).kind,
    "accepted",
  );
  const detailId = removed(RETIRED, (detail) => {
    detail.detailId = OTHER;
  });
  assert.equal(
    fenceDetail(index, { path, snapshotId: RETIRED }, detailId).kind,
    "rejected",
  );
  assert.equal(
    fenceDetail(index, { path, snapshotId: REMOVED_PAGE }, removed(RETIRED))
      .kind,
    "rejected",
  );
  assert.equal(
    fenceDetail(index, { path, snapshotId: OTHER }, removed(RETIRED)).kind,
    "rejected",
  );
  const identity = removed(RETIRED, (detail) => {
    (detail.identity as { id: string }).id = OTHER;
  });
  assert.equal(
    fenceDetail(index, { path, snapshotId: RETIRED }, identity).kind,
    "rejected",
  );
  assert.equal(
    fenceDetail(index, { path, snapshotId: RETIRED }, current("guide")).kind,
    "rejected",
  );
});

test("a removed detail uses its published detail id", () => {
  const replaced = indexFixture((raw) => {
    raw.comparisonUrl = `mokly-viewer/diffs/generations/${OTHER}/`;
  });
  assert.equal(
    fenceDetail(
      replaced,
      { path: "product/browse/home/retired", snapshotId: RETIRED },
      removed(RETIRED),
    ).kind,
    "accepted",
  );
});
