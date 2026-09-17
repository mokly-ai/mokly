import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { loadSource } from "../src/viewer/source.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("URL transport omits credentials and accepts a same-origin final URL", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    assert.equal(init.credentials, "omit");
    assert.notEqual(init.redirect, "error");
    return {
      ok: true,
      url: "https://screens.test/current/catalogue.json",
      json: async () => catalogue,
    };
  });
  const result = await loadSource(
    "https://screens.test/catalogue.json",
    undefined,
    new AbortController().signal,
  );
  assert.equal(result.url.href, "https://screens.test/");
  assert.deepEqual(result.catalogue, catalogue);
});

test("URL transport rejects a redirect outside its configured origin", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    url: "https://elsewhere.test/catalogue.json",
    json: async () => catalogue,
  }));
  await assert.rejects(
    loadSource(
      "https://screens.test/catalogue.json",
      undefined,
      new AbortController().signal,
    ),
  );
});

test("fetcher cancellation fences a late response", async () => {
  const controller = new AbortController();
  await assert.rejects(
    loadSource(
      async ({ signal }) => {
        assert.equal(signal, controller.signal);
        controller.abort();
        return {
          catalogue,
          url: new URL("https://screens.test/catalogue.json"),
        };
      },
      undefined,
      controller.signal,
    ),
    { name: "AbortError" },
  );
});

test("every fetched payload goes through the catalogue reader", async () => {
  await assert.rejects(
    loadSource(
      async () => ({
        catalogue: { ...catalogue, schemaVersion: 2 } as never,
        url: new URL("https://screens.test/catalogue.json"),
      }),
      undefined,
      new AbortController().signal,
    ),
  );
});
