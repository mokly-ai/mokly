import assert from "node:assert/strict";
import { test } from "node:test";

import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";
import { loadFencedDetail, loadRefresh } from "../src/shell/data_requests.js";
import { routeFromUrl } from "../src/shell/routes.js";

import {
  catalogueFixture,
  detailFixture,
  indexFixture,
} from "./catalogue_v9_fixture.js";
import { FakeDataSource, flush } from "./data_fakes.js";

test("an unreadable loaded detail rejects instead of becoming an entry failure", async () => {
  const source = new FakeDataSource();
  const request = { path: "product/browse/home" };
  const loading = loadFencedDetail(
    source,
    indexFixture(),
    request,
    new AbortController().signal,
  );
  source
    .detail(request.path)
    .resolve(readEntryDetail({ ...detailFixture(request), identity: null }));
  await assert.rejects(loading, {
    name: "TypeError",
    message: "Cannot read properties of null (reading 'id')",
  });
});

test("an unreadable loaded refresh route rejects instead of becoming a refresh failure", async () => {
  const source = new FakeDataSource();
  const route = routeFromUrl(
    catalogueFixture(),
    new URL("/view/product/browse/home/", "https://catalogue.test"),
  );
  const loading = loadRefresh(
    source,
    indexFixture(),
    () => route,
    1,
    new AbortController().signal,
  );
  source
    .index()
    .resolve(
      readCatalogueIndex({ ...indexFixture(), revision: 1, screens: null }),
    );
  await assert.rejects(loading, {
    name: "TypeError",
    message: "index.screens is not iterable",
  });
});

test("transport and version errors from retrying the index retain their delivery outcomes", async () => {
  const request = { path: "product/browse/home" };
  const route = routeFromUrl(
    catalogueFixture(),
    new URL(`/view/${request.path}/`, "https://catalogue.test"),
  );
  const version = new MoklyVersionError("catalogue", 10, 9);
  for (const [error, expected] of [
    [new Error("offline"), { kind: "failed" }],
    [version, { kind: "version", error: version }],
  ] as const) {
    const detailSource = new FakeDataSource();
    const loadingDetail = loadFencedDetail(
      detailSource,
      indexFixture(),
      request,
      new AbortController().signal,
    );
    detailSource.detail(request.path).resolve({
      ...detailFixture(request),
      revision: 1,
    });
    await flush();
    detailSource.index().reject(error);
    let detailOutcome;
    await assert.doesNotReject(async () => {
      detailOutcome = await loadingDetail;
    });
    assert.deepEqual(detailOutcome, expected);

    const refreshSource = new FakeDataSource();
    const loadingRefresh = loadRefresh(
      refreshSource,
      indexFixture(),
      () => route,
      1,
      new AbortController().signal,
    );
    refreshSource.index().resolve(indexFixture());
    await flush();
    refreshSource.detail(request.path).resolve(detailFixture(request));
    await flush();
    refreshSource.index().reject(error);
    let refreshOutcome;
    await assert.doesNotReject(async () => {
      refreshOutcome = await loadingRefresh;
    });
    assert.deepEqual(refreshOutcome, expected);
  }
});
