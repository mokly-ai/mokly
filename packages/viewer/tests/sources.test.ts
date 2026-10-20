import assert from "node:assert/strict";
import { test } from "node:test";

import type { EntryDetailV2 } from "../src/catalogue/types.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";
import { embeddedDataSource } from "../src/viewer/index_source.js";
import {
  DeliveryFetchError,
  fetchJson,
  loadDetailResult,
  loadIndexSource,
  sourceUrl,
  type JsonFetch,
} from "../src/viewer/sources.js";

import {
  detailFixture,
  indexFixture,
  rawDetailFixtures,
  rawIndexFixture,
} from "./catalogue_v7_fixture.js";

const ORIGIN = "https://catalogue.test";

interface FakeAnswer {
  status?: number;
  url?: string;
  type?: string;
  body?: unknown;
}

/** A fetch that answers from a table and records each request. */
function fakeFetch(answer: (url: URL) => FakeAnswer) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: JsonFetch = async (url, init) => {
    requests.push({ url: url.href, init });
    const { status = 200, type = "application/json", body } = answer(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      url: answer(url).url ?? url.href,
      headers: new Headers({ "content-type": type }),
      json: async () => body,
    } as Response;
  };
  return { fetch, requests };
}

const signal = new AbortController().signal;

test("a source URL is HTTP(S) without userinfo or fragment", () => {
  assert.equal(sourceUrl(`${ORIGIN}/mokly-viewer/index.json`).origin, ORIGIN);
  for (const value of [
    "file:///catalogue.json",
    "https://user:pass@catalogue.test/",
    "https://catalogue.test/index.json#part",
    "data:application/json,{}",
  ])
    assert.throws(() => sourceUrl(value), DeliveryFetchError);
  assert.throws(() => sourceUrl("/relative.json"));
});

test("JSON routes are plain GETs that omit credentials", async () => {
  const { fetch, requests } = fakeFetch(() => ({ body: { ok: true } }));
  const url = new URL(`${ORIGIN}/mokly-viewer/index.json`);
  assert.deepEqual(await fetchJson(url, signal, fetch), {
    value: { ok: true },
    url,
  });
  assert.deepEqual(requests, [
    { url: url.href, init: { credentials: "omit", signal } },
  ]);
});

test("a redirect elsewhere, a failure status or another type fails", async () => {
  const url = new URL(`${ORIGIN}/mokly-viewer/index.json`);
  for (const answer of [
    { url: "https://elsewhere.test/mokly-viewer/index.json", body: {} },
    { status: 404, body: {} },
    { status: 500, body: {} },
    { type: "text/html", body: {} },
    { type: "application/jsonp", body: {} },
  ])
    await assert.rejects(
      fetchJson(url, signal, fakeFetch(() => answer).fetch),
      DeliveryFetchError,
    );
  const sameOrigin = fakeFetch(() => ({
    url: `${ORIGIN}/moved/index.json`,
    type: "application/json; charset=utf-8",
    body: 1,
  }));
  assert.equal(
    (await fetchJson(url, signal, sameOrigin.fetch)).url.pathname,
    "/moved/index.json",
  );
});

test("a late answer after cancellation is not adopted", async () => {
  const controller = new AbortController();
  const { fetch } = fakeFetch(() => ({ body: rawIndexFixture() }));
  const late: JsonFetch = async (url, init) => {
    controller.abort();
    return fetch(url, init);
  };
  await assert.rejects(
    loadIndexSource(`${ORIGIN}/index.json`, undefined, controller.signal, late),
  );
});

test("an object index needs its base address and a URL index refuses one", async () => {
  const loaded = await loadIndexSource(
    rawIndexFixture(),
    `${ORIGIN}/nested/path`,
    signal,
  );
  assert.equal(loaded.root.href, `${ORIGIN}/`);
  assert.equal(loaded.index.schemaVersion, 7);
  await assert.rejects(
    loadIndexSource(rawIndexFixture(), undefined, signal),
    DeliveryFetchError,
  );
  await assert.rejects(
    loadIndexSource(`${ORIGIN}/index.json`, ORIGIN, signal),
    DeliveryFetchError,
  );
});

test("every fetched index goes through the version gate and the reader", async () => {
  const fetched = fakeFetch(() => ({ body: rawIndexFixture() }));
  const loaded = await loadIndexSource(
    `${ORIGIN}/mokly-viewer/index.json`,
    undefined,
    signal,
    fetched.fetch,
  );
  assert.equal(loaded.root.href, `${ORIGIN}/`);
  const older = fakeFetch(() => ({
    body: { ...rawIndexFixture(), schemaVersion: 6 },
  }));
  await assert.rejects(
    loadIndexSource(`${ORIGIN}/index.json`, undefined, signal, older.fetch),
    MoklyVersionError,
  );
});

test("a detail URL resolves on the artifact origin only", async () => {
  const root = new URL(`${ORIGIN}/`);
  const body = rawDetailFixtures().current.guide;
  const { fetch, requests } = fakeFetch(() => ({ body }));
  const detail = await loadDetailResult(
    "mokly-viewer/entries/guide.json",
    root,
    signal,
    fetch,
  );
  assert.equal(detail.entry.path, "guide");
  assert.equal(requests[0]!.url, `${ORIGIN}/mokly-viewer/entries/guide.json`);
  await assert.rejects(
    loadDetailResult("https://elsewhere.test/guide.json", root, signal, fetch),
    DeliveryFetchError,
  );
  assert.equal(
    (await loadDetailResult(structuredClone(body!), root, signal)).entry.path,
    "guide",
  );
  await assert.rejects(
    loadDetailResult(
      { ...body!, schemaVersion: 3 } as unknown as EntryDetailV2,
      root,
      signal,
    ),
    MoklyVersionError,
  );
});

test("an embedded detail source may answer with an object, a URL or a promise", async () => {
  const index = indexFixture();
  const loaded = { index, root: new URL(`${ORIGIN}/`) };
  const calls: [string, string | undefined][] = [];
  let deployments = 0;
  let failures = 0;
  const source = embeddedDataSource(
    rawIndexFixture(),
    loaded,
    async (path, snapshotId) => {
      calls.push([path, snapshotId]);
      return rawDetailFixtures().current[path]!;
    },
    {
      deploymentChanged: () => (deployments += 1),
      detailFailed: () => (failures += 1),
    },
  );
  const detail = await source.loadDetail({ path: "guide" }, index, signal);
  assert.deepEqual(detail, detailFixture({ path: "guide" }));
  assert.deepEqual(calls, [["guide", undefined]]);
  assert.equal(await source.loadIndex(signal), index);
  source.deploymentChanged();
  source.detailFailed?.({ path: "guide" });
  assert.equal(deployments, 1);
  assert.equal(failures, 1);
  assert.equal(source.live, undefined);
});
