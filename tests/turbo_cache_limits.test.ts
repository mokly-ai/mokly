import assert from "node:assert/strict";
import test from "node:test";

import { createCacheHandler } from "../scripts/turbo-cache/artifacts.js";

import {
  cacheBindings,
  cacheRequest,
  MemoryArtifactStore,
} from "./helpers/turbo_cache.js";

test("cache validates media type, length, duration and tag before body consumption", async () => {
  const cases = [
    [{ "Content-Type": "text/plain" }, 415],
    [{ "Content-Length": "" }, 400],
    [{ "Content-Length": "-1" }, 400],
    [{ "Content-Length": "1.5" }, 400],
    [{ "Content-Length": "9007199254740992" }, 400],
    [{ "Content-Length": "100000001" }, 413],
    [{ "x-artifact-duration": "-1" }, 400],
    [{ "x-artifact-duration": "1.1" }, 400],
    [{ "x-artifact-duration": "9007199254740992" }, 400],
    [{ "x-artifact-tag": "a".repeat(601) }, 400],
  ] as const;
  for (const [invalid, status] of cases) {
    let reads = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          reads++;
        },
      },
      { highWaterMark: 0 },
    );
    const headers = new Headers({
      Authorization: `Bearer ${cacheBindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN}`,
      "Content-Type": "application/octet-stream",
      "Content-Length": "1",
      ...invalid,
    });
    const request = new Request(
      "https://cache.example/v8/artifacts/abc?slug=mokly",
      { method: "PUT", headers, body: stream, duplex: "half" } as RequestInit,
    );
    const store = new MemoryArtifactStore();
    assert.equal(
      (await createCacheHandler(store, cacheBindings)(request)).status,
      status,
      JSON.stringify(invalid),
    );
    assert.equal(reads, 0);
    assert.equal(request.bodyUsed, false);
    assert.deepEqual(store.writes, []);
  }
});

test("auth, namespace, method and hash errors never consume upload bodies", async () => {
  for (const [principal, team, method, hash, status] of [
    ["reader", "mokly", "PUT", "abc", 403],
    ["pr", "mokly", "PUT", "abc", 403],
    ["trusted", "wrong", "PUT", "abc", 403],
    ["trusted", "mokly", "DELETE", "abc", 405],
    ["trusted", "mokly", "PUT", "invalid!", 400],
  ] as const) {
    const store = new MemoryArtifactStore();
    const request = cacheRequest(`/v8/artifacts/${hash}`, {
      principal,
      team,
      method,
      body: "must not read",
    });
    const response = await createCacheHandler(store, cacheBindings)(request);
    assert.equal(response.status, status);
    assert.equal(request.bodyUsed, false);
    assert.deepEqual(store.writes, []);
  }
  const request = cacheRequest(undefined, {
    method: "PUT",
    body: "must not read",
    headers: { Authorization: "Bearer wrong" },
  });
  assert.equal(
    (
      await createCacheHandler(
        new MemoryArtifactStore(),
        cacheBindings,
      )(request)
    ).status,
    401,
  );
  assert.equal(request.bodyUsed, false);
});

test("optional diagnostic formats are dropped while uploads continue", async () => {
  for (const ci of ["GITHUB_ACTIONS", "!".repeat(51)]) {
    const store = new MemoryArtifactStore();
    const handle = createCacheHandler(store, cacheBindings);
    const response = await handle(
      cacheRequest(undefined, {
        method: "PUT",
        body: "bytes",
        headers: {
          "x-artifact-sha": "not-hex",
          "x-artifact-dirty-hash": "a".repeat(129),
          "x-artifact-client-ci": ci,
          "x-artifact-client-interactive": "future",
        },
      }),
    );
    assert.equal(response.status, 202);
    assert.deepEqual(store.objects.get("mokly/abc")!.metadata, {
      duration: "0",
      principal: "trusted-writer",
    });
    const download = await handle(cacheRequest());
    for (const header of [
      "x-artifact-sha",
      "x-artifact-dirty-hash",
      "x-artifact-client-ci",
      "x-artifact-client-interactive",
      "x-artifact-principal",
    ])
      assert.equal(download.headers.get(header), null);
  }
});

test("JSON and array limits reject malformed, oversized or invalid payloads", async () => {
  const handle = createCacheHandler(new MemoryArtifactStore(), cacheBindings);
  for (const [path, body, status] of [
    ["/v8/artifacts", "bad JSON", 400],
    ["/v8/artifacts", "[]", 400],
    ["/v8/artifacts", '{"hashes":[1]}', 400],
    ["/v8/artifacts", '{"hashes":["no!"]}', 400],
    ["/v8/artifacts/events", "{}", 400],
    ["/v8/artifacts/events", JSON.stringify(Array(1025).fill(null)), 413],
    ["/v8/artifacts", JSON.stringify({ hashes: Array(1025).fill("abc") }), 413],
    ["/v8/artifacts/events", " ".repeat(1_048_577), 413],
  ] as const)
    assert.equal(
      (await handle(cacheRequest(path, { method: "POST", body }))).status,
      status,
    );
  assert.deepEqual(
    await (
      await handle(
        cacheRequest("/v8/artifacts", {
          method: "POST",
          body: '{"hashes":[]}',
        }),
      )
    ).json(),
    {},
  );
  const actual = await handle(
    cacheRequest("/v8/artifacts/events", {
      method: "POST",
      body: " ".repeat(1_048_577),
      headers: { "Content-Length": "0" },
    }),
  );
  assert.equal(actual.status, 413);
});

test("zero-length uploads and maximum safe durations round-trip", async () => {
  const store = new MemoryArtifactStore();
  const handle = createCacheHandler(store, cacheBindings);
  assert.equal(
    (
      await handle(
        cacheRequest(undefined, {
          method: "PUT",
          body: "",
          headers: {
            "x-artifact-duration": String(Number.MAX_SAFE_INTEGER),
            "x-artifact-tag": "x".repeat(600),
          },
        }),
      )
    ).status,
    202,
  );
  const response = await handle(cacheRequest());
  assert.equal(response.headers.get("Content-Length"), "0");
  assert.equal(
    response.headers.get("x-artifact-duration"),
    String(Number.MAX_SAFE_INTEGER),
  );
  assert.equal(await response.text(), "");
});
