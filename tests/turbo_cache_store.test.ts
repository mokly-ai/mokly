import assert from "node:assert/strict";
import test from "node:test";

import type { R2Bucket } from "@cloudflare/workers-types";

import { createCacheHandler } from "../scripts/turbo-cache/artifacts.js";
import { CacheError, errorResponse } from "../scripts/turbo-cache/errors.js";
import { R2ArtifactStore } from "../scripts/turbo-cache/r2.js";
import worker from "../scripts/turbo-cache/worker.js";

import { cacheBindings, cacheRequest } from "./helpers/turbo_cache.js";

const metadata = {
  duration: "42",
  principal: "trusted-writer" as const,
  tag: "first",
  sha: "abc",
  dirtyHash: "def",
};

function bucketFixture(consume = true) {
  const objects = new Map<
    string,
    { bytes: Uint8Array; customMetadata: Record<string, string>; size: number }
  >();
  const calls: {
    key: string;
    options: {
      onlyIf: Headers;
      customMetadata: Record<string, string>;
      httpMetadata: { contentType: string };
    };
  }[] = [];
  const known = new WeakSet<ReadableStream<Uint8Array>>();
  let heads = 0;
  let failure = false;
  const bucket = {
    async head(key: string) {
      heads++;
      if (failure) throw new Error("storage failure");
      return objects.get(key) ?? null;
    },
    async get(key: string) {
      const object = objects.get(key);
      return object
        ? { ...object, body: new Response(Uint8Array.from(object.bytes)).body }
        : null;
    },
    async put(
      key: string,
      body: ReadableStream<Uint8Array>,
      options: {
        onlyIf: Headers;
        customMetadata: Record<string, string>;
        httpMetadata: { contentType: string };
      },
    ) {
      calls.push({ key, options });
      if (failure) throw new Error("storage failure");
      assert.ok(known.has(body), "R2 requires a known-length stream");
      if (!consume) return null;
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      if (objects.has(key)) return null;
      const object = {
        bytes,
        size: bytes.byteLength,
        customMetadata: { ...options.customMetadata },
      };
      objects.set(key, object);
      return object;
    },
  } as unknown as Pick<R2Bucket, "head" | "get" | "put">;
  const lengths: number[] = [];
  const makeStream = (length: number) => {
    lengths.push(length);
    const pair = new TransformStream<Uint8Array, Uint8Array>();
    known.add(pair.readable);
    return pair;
  };
  return {
    bucket,
    objects,
    calls,
    lengths,
    makeStream,
    get heads() {
      return heads;
    },
    fail() {
      failure = true;
    },
  };
}

test("R2 adapter calls atomic conditional PUT with known length and complete metadata", async () => {
  const fixture = bucketFixture();
  const store = new R2ArtifactStore(fixture.bucket, fixture.makeStream);
  assert.equal(
    await store.putIfAbsent(
      "mokly/abc",
      new Response("first").body!,
      metadata,
      5,
    ),
    true,
  );
  assert.deepEqual(fixture.lengths, [5]);
  assert.equal(fixture.heads, 0);
  const call = fixture.calls[0]!;
  assert.equal(call.key, "mokly/abc");
  assert.ok(call.options.onlyIf instanceof Headers);
  assert.deepEqual([...call.options.onlyIf], [["if-none-match", "*"]]);
  assert.deepEqual(call.options.customMetadata, metadata);
  assert.deepEqual(call.options.httpMetadata, {
    contentType: "application/octet-stream",
  });
  assert.deepEqual(await store.head("mokly/abc"), { size: 5, metadata });
  const downloaded = await store.get("mokly/abc");
  assert.equal(await new Response(downloaded!.body).text(), "first");
  assert.equal(await store.get("mokly/def"), null);
  assert.equal(await store.head("mokly/def"), null);
});

test("R2 conditional null retains first bytes and every metadata field", async () => {
  const fixture = bucketFixture();
  const store = new R2ArtifactStore(fixture.bucket, fixture.makeStream);
  await store.putIfAbsent(
    "mokly/abc",
    new Response("first").body!,
    metadata,
    5,
  );
  assert.equal(
    await store.putIfAbsent(
      "mokly/abc",
      new Response("second").body!,
      { duration: "99", principal: "pr-writer", tag: "second" },
      6,
    ),
    false,
  );
  assert.equal(
    new TextDecoder().decode(fixture.objects.get("mokly/abc")!.bytes),
    "first",
  );
  assert.deepEqual(fixture.objects.get("mokly/abc")!.customMetadata, metadata);
});

test("stored metadata 500s reach the injected logger and retain their wire response", async () => {
  for (const corrupt of [
    { size: -1, customMetadata: metadata },
    {
      size: 5,
      customMetadata: { ...metadata, principal: "private-principal-marker" },
    },
    {
      size: 5,
      customMetadata: { ...metadata, duration: "private-duration-marker" },
    },
  ]) {
    const fixture = bucketFixture();
    fixture.objects.set("mokly/abc", {
      bytes: new TextEncoder().encode("first"),
      ...corrupt,
    });
    const messages: string[] = [];
    const handle = createCacheHandler(
      new R2ArtifactStore(fixture.bucket, fixture.makeStream),
      cacheBindings,
      (message) => {
        messages.push(message);
      },
    );
    for (const method of ["GET", "HEAD"]) {
      const response = await handle(cacheRequest(undefined, { method }));
      assert.equal(response.status, 500);
      if (method === "HEAD") assert.equal(response.body, null);
      else {
        const detail = {
          code: "internal_error",
          message: "Invalid stored artifact metadata.",
        };
        assert.deepEqual(await response.json(), { ...detail, error: detail });
      }
    }
    assert.deepEqual(
      messages,
      Array(2).fill("Error: Invalid stored artifact metadata."),
    );
    assert.ok(messages.every((message) => !message.includes("private-")));
  }
});

test("typed errors above 500 log once while client errors do not log", async () => {
  const messages: string[] = [];
  const logger = (message: string) => {
    messages.push(message);
  };
  const server = errorResponse(
    new CacheError(503, "internal_error", "Cache unavailable."),
    false,
    logger,
  );
  const client = errorResponse(
    new CacheError(404, "not_found", "Artifact not found."),
    true,
    logger,
  );
  assert.equal(server.status, 503);
  assert.equal(client.status, 404);
  assert.equal(client.body, null);
  assert.deepEqual(messages, ["Error: Cache unavailable."]);
});

test("R2 early conditional refusal drains the stream and exceptions propagate", async () => {
  const early = bucketFixture(false);
  assert.equal(
    await new R2ArtifactStore(early.bucket, early.makeStream).putIfAbsent(
      "mokly/abc",
      new Response("first").body!,
      metadata,
      5,
    ),
    false,
  );
  const broken = bucketFixture();
  broken.fail();
  const store = new R2ArtifactStore(broken.bucket, broken.makeStream);
  await assert.rejects(
    store.putIfAbsent("mokly/abc", new Response("first").body!, metadata, 5),
    /storage failure/,
  );
  await assert.rejects(store.head("mokly/abc"), /storage failure/);
});

test("R2 concurrent conditional writes keep one complete winner", async () => {
  const fixture = bucketFixture();
  const store = new R2ArtifactStore(fixture.bucket, fixture.makeStream);
  const results = await Promise.all([
    store.putIfAbsent("mokly/abc", new Response("first").body!, metadata, 5),
    store.putIfAbsent(
      "mokly/abc",
      new Response("second").body!,
      { duration: "99", principal: "pr-writer", tag: "second" },
      6,
    ),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  const object = fixture.objects.get("mokly/abc")!;
  const body = new TextDecoder().decode(object.bytes);
  assert.equal(object.customMetadata.tag, body);
});

test("R2 stream failures cannot install partial artifact bytes", async () => {
  const fixture = bucketFixture();
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(new TextEncoder().encode("partial"));
      } else controller.error(new Error("stream failure"));
    },
  });
  const store = new R2ArtifactStore(fixture.bucket, fixture.makeStream);
  await assert.rejects(
    store.putIfAbsent("mokly/abc", body, metadata, 20),
    /stream failure/,
  );
  assert.equal(fixture.objects.size, 0);
});

test("fetch entry composes the R2 boundary without adding Workers globals to root types", async () => {
  const fixture = bucketFixture();
  const bindings = { ...cacheBindings, ARTIFACTS: fixture.bucket };
  const request = cacheRequest("/v8/artifacts/status") as unknown as Parameters<
    typeof worker.fetch
  >[0];
  const response = await worker.fetch(request, bindings);
  assert.deepEqual(await response.json(), { status: "enabled" });
  const head = cacheRequest(undefined, {
    method: "HEAD",
  }) as unknown as Parameters<typeof worker.fetch>[0];
  const missing = await worker.fetch(head, bindings);
  assert.equal(missing.status, 404);
  assert.equal(missing.body, null);
});
