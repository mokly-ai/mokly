import assert from "node:assert/strict";
import test from "node:test";

import { uploadMissingBlobs } from "../dist/publish/blobs.js";
import { ReplanRequired } from "../dist/publish/retry.js";
import type { PlanResponse } from "../dist/publish/types.js";

const digests = ["1".repeat(64), "2".repeat(64), "3".repeat(64)];
const plan: PlanResponse = {
  schemaVersion: 1,
  upload: { id: "upload-1", expiresAt: "2026-09-26T13:00:00.000Z" },
  missing: digests,
  blobUrl: "https://api.example.com/uploads/upload-1/blobs/{sha256}",
  completeUrl: "https://api.example.com/uploads/upload-1/complete",
};
const blobs = new Map(
  digests.map((sha256, index) => [
    sha256,
    { sha256, size: index + 1, bytes: Buffer.alloc(index + 1, index) },
  ]),
);
const options = { endpoint: "https://api.example.com/plan", token: "secret" };
const retryDependencies = {
  now: () => new Date("2026-09-26T12:00:00.000Z"),
  random: () => 0,
  sleep: async () => undefined,
};

test("blob uploads use exact URLs, headers and bytes", async () => {
  const received = new Set<string>();
  const uploaded = await uploadMissingBlobs(plan, blobs, options, 2, {
    ...retryDependencies,
    fetch: async (url, init) => {
      const digest = String(url).split("/").at(-1)!;
      const blob = blobs.get(digest)!;
      const headers = new Headers(init?.headers);
      assert.equal(init?.method, "PUT");
      assert.equal(init?.redirect, "manual");
      assert.equal(headers.get("Authorization"), "Bearer secret");
      assert.equal(headers.get("Content-Type"), "application/octet-stream");
      assert.equal(headers.get("Content-Length"), String(blob.size));
      assert.deepEqual(init?.body, blob.bytes);
      received.add(digest);
      return new Response(null, { status: 204 });
    },
  });
  assert.deepEqual(uploaded, new Set(digests));
  assert.deepEqual(received, new Set(digests));
});

test("blob rejection categories and expiry are stable", async () => {
  for (const [status, code] of [
    [400, "upload-invalid-bundle"],
    [404, "upload-failed"],
  ] as const)
    await assert.rejects(
      uploadMissingBlobs(
        { ...plan, missing: [digests[0]!] },
        blobs,
        options,
        1,
        {
          ...retryDependencies,
          fetch: async () => new Response(null, { status }),
        },
      ),
      (error: unknown) => (error as { code: string }).code === code,
    );
  await assert.rejects(
    uploadMissingBlobs({ ...plan, missing: [digests[0]!] }, blobs, options, 1, {
      ...retryDependencies,
      fetch: async () => new Response(null, { status: 410 }),
    }),
    ReplanRequired,
  );
  await assert.rejects(
    uploadMissingBlobs(
      {
        ...plan,
        upload: { ...plan.upload, expiresAt: "2026-09-26T12:00:00.000Z" },
        missing: [digests[0]!],
      },
      blobs,
      options,
      1,
      {
        ...retryDependencies,
        fetch: async () => assert.fail("expired uploads must not issue a PUT"),
      },
    ),
    ReplanRequired,
  );
});

test("blob workers stay bounded and stop after the first failure", async () => {
  let active = 0;
  let maximum = 0;
  await uploadMissingBlobs(plan, blobs, options, 2, {
    ...retryDependencies,
    fetch: async () => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(maximum, 2);

  let calls = 0;
  let releaseFailure!: () => void;
  const failureReady = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  let secondAborted = false;
  await assert.rejects(
    uploadMissingBlobs(plan, blobs, options, 2, {
      ...retryDependencies,
      fetch: async (_url, init) => {
        calls++;
        if (calls === 1) {
          await failureReady;
          return new Response(null, { status: 400 });
        }
        releaseFailure();
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            secondAborted = true;
            reject(new Error("cancelled peer"));
          });
        });
      },
    }),
    /upload-invalid-bundle/,
  );
  assert.equal(calls, 2);
  assert.equal(secondAborted, true);
});

test("blob transport retries honor Retry-After without leaking tokens", async () => {
  let calls = 0;
  const waits: number[] = [];
  await uploadMissingBlobs(
    { ...plan, missing: [digests[0]!] },
    blobs,
    { ...options, token: "private-token" },
    1,
    {
      ...retryDependencies,
      sleep: async (milliseconds) => void waits.push(milliseconds),
      fetch: async () => {
        if (++calls === 1)
          return new Response("private-token", {
            status: 503,
            headers: { "Retry-After": "2" },
          });
        return new Response(null, { status: 204 });
      },
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2_000]);
});

test("successful digests are reported before a later blob re-plans", async () => {
  let calls = 0;
  const uploaded: string[] = [];
  await assert.rejects(
    uploadMissingBlobs(
      { ...plan, missing: digests.slice(0, 2) },
      blobs,
      options,
      1,
      {
        ...retryDependencies,
        fetch: async () =>
          new Response(null, { status: ++calls === 1 ? 204 : 410 }),
      },
      undefined,
      (digest) => uploaded.push(digest),
    ),
    ReplanRequired,
  );
  assert.deepEqual(uploaded, [digests[0]]);
});
