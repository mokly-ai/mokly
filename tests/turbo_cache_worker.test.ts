import assert from "node:assert/strict";
import test from "node:test";

import { createCacheHandler } from "../scripts/turbo-cache/artifacts.js";

import {
  cacheBindings,
  cacheRequest,
  MemoryArtifactStore,
} from "./helpers/turbo_cache.js";

test("cache wire routes round-trip bytes, headers, batch shape, status and events", async () => {
  const store = new MemoryArtifactStore();
  const handle = createCacheHandler(store, cacheBindings);
  const upload = await handle(
    cacheRequest(undefined, {
      method: "PUT",
      body: "artifact bytes",
      headers: {
        "x-artifact-duration": "456",
        "x-artifact-tag": "c2lnbmF0dXJl",
        "x-artifact-sha": "ABC",
        "x-artifact-dirty-hash": "def",
      },
    }),
  );
  assert.equal(upload.status, 202);
  assert.deepEqual(await upload.json(), {
    urls: ["https://cache.example/v8/artifacts/abc?slug=mokly"],
  });
  assert.equal(
    store.objects.get("mokly/abc")!.metadata.principal,
    "trusted-writer",
  );
  for (const method of ["GET", "HEAD"]) {
    const response = await handle(
      cacheRequest(undefined, { method, principal: "reader" }),
    );
    assert.equal(response.status, 200);
    for (const [name, value] of [
      ["Content-Type", "application/octet-stream"],
      ["Content-Length", "14"],
      ["x-artifact-duration", "456"],
      ["x-artifact-tag", "c2lnbmF0dXJl"],
      ["x-artifact-sha", "ABC"],
      ["x-artifact-dirty-hash", "def"],
      ["Cache-Control", "private, no-store"],
    ])
      assert.equal(response.headers.get(name!), value);
    assert.equal(response.headers.get("Content-Encoding"), null);
    assert.equal(response.headers.get("principal"), null);
    assert.equal(
      await response.text(),
      method === "HEAD" ? "" : "artifact bytes",
    );
  }
  const query = await handle(
    cacheRequest("/v8/artifacts", {
      method: "POST",
      body: JSON.stringify({ hashes: ["abc", "def"] }),
    }),
  );
  assert.deepEqual(await query.json(), {
    abc: {
      size: 14,
      taskDurationMs: 456,
      tag: "c2lnbmF0dXJl",
      sha: "ABC",
      dirtyHash: "def",
    },
    def: null,
  });
  assert.deepEqual(
    await (await handle(cacheRequest("/v8/artifacts/status"))).json(),
    { status: "enabled" },
  );
  for (const items of [[], [null, 42, "future event", { unknown: true }]]) {
    const events = await handle(
      cacheRequest("/v8/artifacts/events", {
        method: "POST",
        body: JSON.stringify(items),
      }),
    );
    assert.equal(events.status, 200);
    assert.equal(await events.text(), "");
  }
});

test("write-once retains the complete first bytes and metadata during concurrent PUTs", async () => {
  const store = new MemoryArtifactStore();
  const handle = createCacheHandler(store, cacheBindings);
  const requests = ["first", "second"].map((body, index) =>
    cacheRequest(undefined, {
      method: "PUT",
      body,
      headers: {
        "x-artifact-duration": String(index + 1),
        "x-artifact-tag": body,
      },
    }),
  );
  const responses = await Promise.all(requests.map(handle));
  assert.deepEqual(
    responses.map((response) => response.status),
    [202, 202],
  );
  const winner = store.objects.get("mokly/abc")!;
  const body = new TextDecoder().decode(winner.bytes);
  assert.equal(winner.metadata.tag, body);
  assert.equal(winner.metadata.duration, body === "first" ? "1" : "2");
  assert.equal(store.objects.size, 1);
});

test("PR reads choose per-hash PR hits and fall back to trusted without write-through", async () => {
  const store = new MemoryArtifactStore();
  const handle = createCacheHandler(store, cacheBindings);
  for (const hash of ["abc", "def"])
    assert.equal(
      (
        await handle(
          cacheRequest(`/v8/artifacts/${hash}`, {
            method: "PUT",
            body: "trusted",
          }),
        )
      ).status,
      202,
    );
  assert.equal(
    (
      await handle(
        cacheRequest(undefined, {
          method: "PUT",
          principal: "pr",
          team: "mokly-pr-1",
          body: "scoped",
        }),
      )
    ).status,
    202,
  );
  assert.equal(
    store.objects.get("mokly-pr-1/abc")!.metadata.principal,
    "pr-writer",
  );
  assert.equal(
    await (
      await handle(
        cacheRequest(undefined, { principal: "pr", team: "mokly-pr-1" }),
      )
    ).text(),
    "scoped",
  );
  assert.equal(
    await (
      await handle(
        cacheRequest("/v8/artifacts/def", {
          principal: "pr",
          team: "mokly-pr-1",
        }),
      )
    ).text(),
    "trusted",
  );
  const head = await handle(
    cacheRequest(undefined, {
      method: "HEAD",
      principal: "pr",
      team: "mokly-pr-1",
    }),
  );
  assert.equal(head.headers.get("Content-Length"), "6");
  const query = await handle(
    cacheRequest("/v8/artifacts", {
      method: "POST",
      principal: "pr",
      team: "mokly-pr-1",
      body: JSON.stringify({ hashes: ["abc", "def", "aaa"] }),
    }),
  );
  assert.deepEqual(await query.json(), {
    abc: { size: 6, taskDurationMs: 0 },
    def: { size: 7, taskDurationMs: 0 },
    aaa: null,
  });
  assert.equal(
    (
      await handle(
        cacheRequest(undefined, {
          method: "PUT",
          principal: "pr",
          body: "forbidden",
        }),
      )
    ).status,
    403,
  );
  assert.equal(store.objects.size, 3);
  assert.equal(await (await handle(cacheRequest())).text(), "trusted");
});

test("every HEAD outcome is bodyless and storage errors stay private", async () => {
  const store = new MemoryArtifactStore();
  const handle = createCacheHandler(store, cacheBindings);
  const cases = [
    [cacheRequest(undefined, { method: "HEAD" }), 404],
    [
      cacheRequest(undefined, {
        method: "HEAD",
        headers: { Authorization: "wrong" },
      }),
      401,
    ],
    [cacheRequest(undefined, { method: "HEAD", team: "wrong" }), 403],
    [cacheRequest("/v8/artifacts/invalid!", { method: "HEAD" }), 400],
    [cacheRequest("/v8/artifacts/status", { method: "HEAD" }), 405],
  ] as const;
  for (const [request, status] of cases) {
    const response = await handle(request);
    assert.equal(response.status, status);
    assert.equal(response.body, null);
    assert.equal(await response.text(), "");
  }
  const configured = createCacheHandler(store, {
    ...cacheBindings,
    TURBO_CACHE_TEAM: "",
  });
  assert.equal(
    (await configured(cacheRequest(undefined, { method: "HEAD" }))).body,
    null,
  );
  store.failure = true;
  const response = await handle(cacheRequest());
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("private storage diagnostic"));
  assert.equal(
    (await handle(cacheRequest(undefined, { method: "HEAD" }))).body,
    null,
  );
});

test("forbidden and configuration errors use matching flat and wrapped codes", async () => {
  const store = new MemoryArtifactStore();
  for (const [bindings, request, code, status] of [
    [
      cacheBindings,
      cacheRequest(undefined, {
        method: "PUT",
        principal: "reader",
        body: "denied",
      }),
      "forbidden",
      403,
    ],
    [
      { ...cacheBindings, TURBO_CACHE_TEAM: "" },
      cacheRequest(),
      "configuration_error",
      500,
    ],
  ] as const) {
    const response = await createCacheHandler(store, bindings)(request);
    assert.equal(response.status, status);
    const body = (await response.json()) as {
      code: string;
      message: string;
      error: { code: string; message: string };
    };
    assert.equal(body.code, code);
    assert.deepEqual(body.error, { code: body.code, message: body.message });
  }
});
