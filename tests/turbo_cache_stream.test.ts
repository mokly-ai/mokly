import assert from "node:assert/strict";
import test from "node:test";

import { createCacheHandler } from "../scripts/turbo-cache/artifacts.js";
import type { ArtifactStore } from "../scripts/turbo-cache/store.js";

import {
  cacheBindings,
  cacheRequest,
  MemoryArtifactStore,
} from "./helpers/turbo_cache.js";

test("actual artifact length mismatches abort writes without storing partial bytes", async () => {
  for (const [body, length] of [
    ["too short", 20],
    ["too long", 3],
  ] as const) {
    const store = new MemoryArtifactStore();
    const response = await createCacheHandler(
      store,
      cacheBindings,
    )(
      cacheRequest(undefined, {
        method: "PUT",
        body,
        headers: { "Content-Length": String(length) },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(store.objects.size, 0);
  }
});

test("conditional losers still validate bytes and keep the winner intact", async () => {
  const store = new MemoryArtifactStore();
  const handle = createCacheHandler(store, cacheBindings);
  await handle(
    cacheRequest(undefined, {
      method: "PUT",
      body: "winner",
      headers: { "x-artifact-tag": "winner" },
    }),
  );
  const response = await handle(
    cacheRequest(undefined, {
      method: "PUT",
      body: "loser",
      headers: { "Content-Length": "1" },
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(await (await handle(cacheRequest())).text(), "winner");
  assert.equal(store.objects.get("mokly/abc")!.metadata.tag, "winner");
});

test("artifact uploads reach the store as a stream and never call body buffer methods", async () => {
  let observed = 0;
  const original = new MemoryArtifactStore();
  const store: ArtifactStore = {
    head: (key) => original.head(key),
    get: (key) => original.get(key),
    async putIfAbsent(key, body, metadata, length) {
      assert.ok(body instanceof ReadableStream);
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        observed++;
        chunks.push(item.value);
      }
      assert.equal(observed, 3);
      const copy = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
      return original.putIfAbsent(key, copy, metadata, length);
    },
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const text of ["a", "b", "c"])
        controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  const request = new Request(
    "https://cache.example/v8/artifacts/abc?slug=mokly",
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cacheBindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": "3",
      },
      body: stream,
      duplex: "half",
    } as RequestInit,
  );
  for (const method of ["arrayBuffer", "text", "json", "blob"])
    Object.defineProperty(request, method, {
      value: () => {
        throw new Error("artifact was buffered");
      },
    });
  assert.equal(
    (await createCacheHandler(store, cacheBindings)(request)).status,
    202,
  );
  assert.equal(
    new TextDecoder().decode(original.objects.get("mokly/abc")!.bytes),
    "abc",
  );
});

test("an early existing-key result drains unread bytes without buffering an artifact", async () => {
  const store = new MemoryArtifactStore();
  const early: ArtifactStore = {
    head: (key) => store.head(key),
    get: (key) => store.get(key),
    putIfAbsent: async () => false,
  };
  const handle = createCacheHandler(early, cacheBindings);
  assert.equal(
    (await handle(cacheRequest(undefined, { method: "PUT", body: "abc" })))
      .status,
    202,
  );
  assert.equal(
    (
      await handle(
        cacheRequest(undefined, {
          method: "PUT",
          body: "abc",
          headers: { "Content-Length": "4" },
        }),
      )
    ).status,
    400,
  );
});
