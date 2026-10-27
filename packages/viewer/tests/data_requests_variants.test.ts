import assert from "node:assert/strict";
import { test } from "node:test";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV2,
} from "../src/catalogue/types.js";
import {
  loadRefresh,
  routeDetailRequests,
} from "../src/shell/data_requests.js";
import type { ShellDataSource } from "../src/shell/data_source.js";
import { routeFromUrl } from "../src/shell/routes.js";

import {
  catalogueFixture,
  detailFixture,
  indexFixture,
} from "./catalogue_v8_fixture.js";

const OTHER = "e".repeat(64);
const signal = new AbortController().signal;

function route(path: string) {
  return routeFromUrl(
    catalogueFixture(),
    new URL(path, "https://catalogue.test"),
  );
}

function revised(path: string, revision: number): EntryDetailV2 {
  return { ...detailFixture({ path }), revision };
}

function scripted(
  indexes: readonly CatalogueReadModel[],
  detail: (request: DetailRequest) => EntryDetailV2,
) {
  const calls: DetailRequest[] = [];
  const source: ShellDataSource = {
    async loadIndex() {
      return indexes[0]!;
    },
    async loadDetail(request) {
      calls.push(request);
      return detail(request);
    },
    deploymentChanged() {},
  };
  return { source, calls };
}

test("a variant refresh adopts its own and parent details together", async () => {
  const installed = indexFixture();
  const index = indexFixture((raw) => (raw.revision = 3));
  const { source, calls } = scripted([index], (request) =>
    revised(request.path, 3),
  );
  const outcome = await loadRefresh(
    source,
    installed,
    () => route("/view/components/action/default/"),
    3,
    signal,
  );
  assert.equal(outcome.kind, "accepted");
  assert.deepEqual(calls, [
    { path: "components/action/default" },
    { path: "components/action" },
  ]);
  assert.deepEqual(
    outcome.kind === "accepted"
      ? outcome.details.map(([request]) => request)
      : [],
    routeDetailRequests(index, route("/view/components/action/default/")),
  );
});

test("a variant parent from another deployment replaces the route", async () => {
  const installed = indexFixture();
  const { source } = scripted([indexFixture()], (request) =>
    request.path === "components/action"
      ? { ...revised(request.path, 0), deploymentId: OTHER }
      : revised(request.path, 0),
  );
  assert.deepEqual(
    await loadRefresh(
      source,
      installed,
      () => route("/view/components/action/default/"),
      0,
      signal,
    ),
    { kind: "deployment" },
  );
});
