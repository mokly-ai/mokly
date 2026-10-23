import assert from "node:assert/strict";
import { test } from "node:test";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV2,
} from "../src/catalogue/types.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";
import {
  loadFencedDetail,
  loadRefresh,
  routeDetailRequests,
  routeKey,
} from "../src/shell/data_requests.js";
import type { ShellDataSource } from "../src/shell/data_source.js";
import { routeFromUrl, type ShellRoute } from "../src/shell/routes.js";

import {
  catalogueFixture,
  detailFixture,
  indexFixture,
} from "./catalogue_v7_fixture.js";

const OTHER = "e".repeat(64);
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";

function route(path: string): ShellRoute {
  return routeFromUrl(
    catalogueFixture(),
    new URL(path, "https://catalogue.test"),
  );
}

/** A source that answers from scripts and records every request. */
function scripted(
  indexes: readonly (CatalogueReadModel | Error)[],
  detail: (request: DetailRequest) => EntryDetailV2 | Error,
) {
  const calls = { indexes: 0, details: [] as DetailRequest[] };
  const source: ShellDataSource = {
    async loadIndex() {
      const next = indexes[Math.min(calls.indexes, indexes.length - 1)]!;
      calls.indexes += 1;
      if (next instanceof Error) throw next;
      return next;
    },
    async loadDetail(request) {
      calls.details.push(request);
      const next = detail(request);
      if (next instanceof Error) throw next;
      return next;
    },
    deploymentChanged() {},
  };
  return { source, calls };
}

function revised(path: string, revision: number): EntryDetailV2 {
  return { ...detailFixture({ path }), revision };
}

const signal = new AbortController().signal;

test("each route requests the details its frames and lists read", () => {
  const index = indexFixture();
  const requests = (path: string) => routeDetailRequests(index, route(path));
  assert.deepEqual(requests("/"), []);
  assert.deepEqual(requests("/view/nothing/"), []);
  for (const path of [
    "product/browse/home",
    "product/browse/home/empty",
    "components/action",
    "components/action/default",
    "guide",
    "product",
  ])
    assert.deepEqual(requests(`/view/${path}/`), [{ path }]);
  const tour = index.useCases.find((entry) => entry.path === "tour")!;
  assert.deepEqual(requests("/view/tour/"), [
    { path: "tour" },
    ...[...new Set(tour.steps.map((step) => step.screenPath))].map((path) => ({
      path,
    })),
  ]);
  assert.deepEqual(
    requests(`/view/product/browse/home/retired/?snapshot=${RETIRED}`),
    [{ path: "product/browse/home/retired", snapshotId: RETIRED }],
  );
});

test("a removed route requests nothing without a published comparison", () => {
  const removed = route(
    `/view/product/browse/home/retired/?snapshot=${RETIRED}`,
  );
  const unpublished = { ...indexFixture(), comparisonUrl: null };
  assert.deepEqual(routeDetailRequests(unpublished, removed), []);
});

test("a route requests nothing for an entry the index no longer lists", () => {
  const guide = route("/view/guide/");
  const dropped = indexFixture((raw) => {
    raw.pages = [];
    raw.tree = raw.tree.filter((node) => node.path !== "guide");
  });
  assert.deepEqual(routeDetailRequests(dropped, guide), []);
  const tour = indexFixture();
  const asPage = { ...guide, view: { ...guide.view } };
  if (asPage.view.kind === "target")
    asPage.view.target = {
      ...asPage.view.target,
      entry: { ...tour.useCases[0]!, path: "guide" },
    } as never;
  assert.deepEqual(routeDetailRequests(tour, asPage), []);
});

test("an accepted detail installs against the index it was fenced with", async () => {
  const index = indexFixture();
  const request = { path: "guide" };
  const { source, calls } = scripted([index], () => detailFixture(request));
  const outcome = await loadFencedDetail(source, index, request, signal);
  assert.equal(outcome.kind, "accepted");
  assert.equal(outcome.kind === "accepted" && outcome.index, index);
  assert.equal(calls.indexes, 0);
});

test("a revision mismatch refetches the index exactly once", async () => {
  const request = { path: "guide" };
  const newer = indexFixture((raw) => (raw.revision = 1));
  const first = scripted([newer], () => revised("guide", 1));
  const outcome = await loadFencedDetail(
    first.source,
    indexFixture(),
    request,
    signal,
  );
  assert.equal(outcome.kind === "accepted" && outcome.index, newer);
  assert.equal(first.calls.indexes, 1);
  const stale = scripted([indexFixture()], () => revised("guide", 2));
  assert.deepEqual(
    await loadFencedDetail(stale.source, indexFixture(), request, signal),
    { kind: "failed" },
  );
  assert.equal(stale.calls.indexes, 1);
});

test("another deployment in a detail or a refetched index is reported", async () => {
  const request = { path: "guide" };
  const detail = { ...detailFixture(request), deploymentId: OTHER };
  const moved = scripted([indexFixture()], () => detail);
  assert.deepEqual(
    await loadFencedDetail(moved.source, indexFixture(), request, signal),
    { kind: "deployment" },
  );
  const index = indexFixture((raw) => {
    raw.deploymentId = OTHER;
    raw.revision = 1;
  });
  const replaced = scripted([index], () => ({
    ...revised("guide", 1),
    deploymentId: OTHER,
  }));
  assert.deepEqual(
    await loadFencedDetail(replaced.source, indexFixture(), request, signal),
    { kind: "deployment" },
  );
});

test("a rejected, failed or newer-format detail does not install", async () => {
  const request = { path: "guide" };
  const wrong = scripted([indexFixture()], () =>
    detailFixture({ path: "product" }),
  );
  assert.deepEqual(
    await loadFencedDetail(wrong.source, indexFixture(), request, signal),
    { kind: "failed" },
  );
  const failed = scripted([indexFixture()], () => new Error("offline"));
  assert.deepEqual(
    await loadFencedDetail(failed.source, indexFixture(), request, signal),
    { kind: "failed" },
  );
  const version = new MoklyVersionError("detail", 3, 2);
  const newer = scripted([indexFixture()], () => version);
  assert.deepEqual(
    await loadFencedDetail(newer.source, indexFixture(), request, signal),
    { kind: "version", error: version },
  );
});

test("a refresh adopts the index and the route's details at the message revision", async () => {
  const installed = indexFixture();
  const index = indexFixture((raw) => (raw.revision = 3));
  const { source, calls } = scripted([index], (request) =>
    revised(request.path, 3),
  );
  const outcome = await loadRefresh(
    source,
    installed,
    () => route("/view/tour/"),
    3,
    signal,
  );
  assert.equal(outcome.kind, "accepted");
  if (outcome.kind !== "accepted") return;
  assert.equal(outcome.index, index);
  assert.deepEqual(
    outcome.details.map(([request]) => request),
    routeDetailRequests(index, route("/view/tour/")),
  );
  assert.deepEqual(
    calls.details,
    outcome.details.map(([request]) => request),
  );
});

test("a refresh below the message revision retries once, then fails", async () => {
  const { source, calls } = scripted(
    [indexFixture((raw) => (raw.revision = 2))],
    (request) => revised(request.path, 2),
  );
  assert.deepEqual(
    await loadRefresh(
      source,
      indexFixture(),
      () => route("/view/guide/"),
      3,
      signal,
    ),
    { kind: "failed" },
  );
  assert.equal(calls.indexes, 2);
});

test("a refresh restarts when the route changes while it loads", async () => {
  const index = indexFixture((raw) => (raw.revision = 1));
  let current = route("/view/guide/");
  const { source, calls } = scripted([index], (request) => {
    if (request.path === "guide") current = route("/view/product/");
    return revised(request.path, 1);
  });
  const outcome = await loadRefresh(
    source,
    indexFixture(),
    () => current,
    1,
    signal,
  );
  assert.equal(outcome.kind, "accepted");
  assert.deepEqual(
    outcome.kind === "accepted" && outcome.details.map(([request]) => request),
    [{ path: "product" }],
  );
  assert.equal(calls.indexes, 2);
  assert.equal(routeKey(current), "product\u0000");
});

test("a refresh from another deployment or format does not install", async () => {
  const moved = scripted(
    [indexFixture((raw) => (raw.deploymentId = OTHER))],
    (request) => revised(request.path, 1),
  );
  assert.deepEqual(
    await loadRefresh(
      moved.source,
      indexFixture(),
      () => route("/view/guide/"),
      1,
      signal,
    ),
    { kind: "deployment" },
  );
  assert.equal(moved.calls.details.length, 0);
  const version = new MoklyVersionError("catalogue", 8, 7);
  const newer = scripted([version], () => new Error("unused"));
  assert.deepEqual(
    await loadRefresh(
      newer.source,
      indexFixture(),
      () => route("/view/guide/"),
      1,
      signal,
    ),
    { kind: "version", error: version },
  );
});
