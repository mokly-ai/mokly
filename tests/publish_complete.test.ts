import assert from "node:assert/strict";
import test from "node:test";

import { completeUpload } from "../dist/publish/complete.js";
import { ReplanRequired } from "../dist/publish/retry.js";
import type { PlanResponse } from "../dist/publish/types.js";

const options = { endpoint: "https://api.example.com/plan", token: "secret" };
const plan: PlanResponse = {
  schemaVersion: 1,
  upload: { id: "upload-1", expiresAt: "2026-09-26T13:00:00.000Z" },
  missing: [],
  blobUrl: "https://api.example.com/uploads/upload-1/blobs/{sha256}",
  completeUrl: "https://api.example.com/uploads/upload-1/complete",
};
const retryDependencies = {
  now: () => new Date("2026-09-26T12:00:00.000Z"),
  random: () => 0,
  sleep: async () => undefined,
};

async function complete(response: Response) {
  return completeUpload(plan, options, {
    ...retryDependencies,
    fetch: async (url, init) => {
      assert.equal(url, plan.completeUrl);
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, undefined);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer secret");
      assert.equal(headers.get("Accept"), "application/json");
      assert.equal(headers.get("Content-Length"), "0");
      return response;
    },
  });
}

test("Complete distinguishes new and existing publications", async () => {
  assert.deepEqual(
    await complete(
      Response.json(
        { viewerUrl: "https://mokly.ai/catalogue/../catalogue/one\n" },
        { status: 201 },
      ),
    ),
    { outcome: "published", viewerUrl: "https://mokly.ai/catalogue/one" },
  );
  assert.deepEqual(
    await complete(Response.json({ viewerUrl: "https://mokly.ai/existing" })),
    { outcome: "already-published", viewerUrl: "https://mokly.ai/existing" },
  );
});

test("Complete ignores unreadable and unusable success bodies", async () => {
  for (const response of [
    new Response("not json", {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
    new Response("html", {
      status: 201,
      headers: { "Content-Type": "text/html" },
    }),
    Response.json({ viewerUrl: "/relative" }, { status: 201 }),
    Response.json(
      { viewerUrl: "ftp://example.com/catalogue" },
      { status: 201 },
    ),
    new Response("x".repeat(16 * 1024 * 1024 + 1), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new Error("interrupted body"));
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ),
  ])
    assert.deepEqual(await complete(response), {
      outcome: "published",
      viewerUrl: null,
    });
});

test("Complete rejects other successes and maps terminal statuses", async () => {
  for (const status of [202, 204, 299])
    await assert.rejects(
      complete(new Response(null, { status })),
      /upload-failed/,
    );
  for (const status of [409, 410])
    await assert.rejects(
      complete(new Response(null, { status })),
      ReplanRequired,
    );
  await assert.rejects(
    complete(new Response(null, { status: 404 })),
    /upload-failed/,
  );
});

test("Complete retries temporary statuses", async () => {
  let calls = 0;
  const result = await completeUpload(plan, options, {
    ...retryDependencies,
    fetch: async () => {
      if (++calls === 1) return new Response(null, { status: 503 });
      return Response.json({ viewerUrl: null }, { status: 201 });
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { outcome: "published", viewerUrl: null });
});
