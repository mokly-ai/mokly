import assert from "node:assert/strict";
import { test } from "node:test";

import {
  entryDetailPath,
  INDEX_PATH,
} from "../src/catalogue/delivery_paths.js";
import {
  loadDetailResult,
  loadIndexSource,
  type JsonFetch,
} from "../src/catalogue/sources.js";
import { standaloneDataSource } from "../src/standalone/data_source.js";

import { detailFixture, rawIndexFixture } from "./catalogue_v9_fixture.js";

const origin = "https://catalogue.test";
const request = { path: "guide" };

function fetched(body: unknown) {
  let parsed: unknown;
  const fetch: JsonFetch = async () => {
    const response = Response.json(body);
    const parse = response.json.bind(response);
    response.json = async () => {
      parsed = await parse();
      return parsed;
    };
    return response;
  };
  return {
    fetch,
    parsed: () => parsed,
    standalone: standaloneDataSource({
      fetch,
      location: { href: origin, reload() {} },
    }),
  };
}

test("a fetched URL index keeps the object returned by response.json", async () => {
  const source = fetched(rawIndexFixture());
  const { index } = await loadIndexSource(
    new URL(INDEX_PATH, origin),
    undefined,
    new AbortController().signal,
    source.fetch,
  );
  assert.strictEqual(index, source.parsed(), "URL index was copied");
});

test("a fetched URL detail keeps the object returned by response.json", async () => {
  const source = fetched(detailFixture(request));
  const detail = await loadDetailResult(
    entryDetailPath(request.path),
    new URL(origin),
    new AbortController().signal,
    source.fetch,
  );
  assert.strictEqual(detail, source.parsed(), "URL detail was copied");
});

test("a standalone index keeps the object returned by response.json", async () => {
  const source = fetched(rawIndexFixture());
  const index = await source.standalone.loadIndex(new AbortController().signal);
  assert.strictEqual(index, source.parsed(), "standalone index was copied");
});

test("a standalone detail keeps the object returned by response.json", async () => {
  const source = fetched(detailFixture(request));
  const detail = await source.standalone.loadDetail(
    request,
    rawIndexFixture(),
    new AbortController().signal,
  );
  assert.strictEqual(detail, source.parsed(), "standalone detail was copied");
});

test("a host index source returns a deep copy", async () => {
  const body = rawIndexFixture();
  const { index } = await loadIndexSource(
    body,
    origin,
    new AbortController().signal,
  );
  assert.deepStrictEqual(index, body);
  assert.notStrictEqual(index, body);
  assert.notStrictEqual(index.screens, body.screens);
});

test("a host detail source returns a deep copy", async () => {
  const body = detailFixture(request);
  const detail = await loadDetailResult(
    body,
    new URL(origin),
    new AbortController().signal,
  );
  assert.deepStrictEqual(detail, body);
  assert.notStrictEqual(detail, body);
  assert.notStrictEqual(detail.entry, body.entry);
});
