import assert from "node:assert/strict";
import test from "node:test";

import { buildPlanArchive, requestUploadPlan } from "../dist/publish/plan.js";
import type { UploadManifest } from "../dist/publish/types.js";

import { ownershipMarkerFromFiles } from "./helpers/ownership_marker.js";
import { extractUploadArchive } from "./helpers/upload_archive.js";

const digestA = "1".repeat(64);
const digestB = "2".repeat(64);
const endpoint = "https://api.example.com/plan?project=team";
const manifest: UploadManifest = {
  schemaVersion: 1,
  moklyVersion: "1.2.3",
  repository: { host: "example.com", owner: "team", name: "catalogue" },
  branch: "main",
  headSha: "a".repeat(40),
  baseRef: "origin/main",
  baseSha: "b".repeat(40),
  pullRequest: null,
  configPath: "mokly.config.ts",
  exportedAt: "2026-09-26T12:00:00.000Z",
  comparisonPath: `__mokly/diffs/__generations/${"c".repeat(64)}/review.json`,
};

function files(selectedManifest = manifest): Map<string, Buffer> {
  const map = new Map<string, Buffer>([
    ["index.html", Buffer.from("Home")],
    ["404.html", Buffer.from("Missing")],
    ["mokly-upload.json", Buffer.from(`${JSON.stringify(selectedManifest)}\n`)],
  ]);
  if (selectedManifest.comparisonPath)
    map.set(selectedManifest.comparisonPath, Buffer.from("Review"));
  const ownership = ownershipMarkerFromFiles(map);
  map.set(
    ".mokly-export-artifact",
    Buffer.from(`${JSON.stringify(ownership, null, 2)}\n`),
  );
  return map;
}

function planResponse(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    upload: { id: "upload-1", expiresAt: "2026-09-26T13:00:00.000Z" },
    missing: [digestA, digestB],
    blobUrl: "https://api.example.com/uploads/upload-1/blobs/{sha256}",
    completeUrl: "https://api.example.com/uploads/upload-1/complete",
    ...overrides,
  };
}

const retryDependencies = {
  now: () => new Date("2026-09-26T12:00:00.000Z"),
  random: () => 0,
  sleep: async () => undefined,
};

test("plan archives contain only byte-identical protocol artifacts", async () => {
  const withComparison = files();
  const archive = await buildPlanArchive(withComparison, manifest);
  assert.deepEqual(
    [...(await extractUploadArchive(archive))],
    [
      ["mokly-upload.json", withComparison.get("mokly-upload.json")],
      [".mokly-export-artifact", withComparison.get(".mokly-export-artifact")],
      [manifest.comparisonPath, withComparison.get(manifest.comparisonPath!)],
    ],
  );
  const currentManifest = {
    ...manifest,
    baseRef: null,
    baseSha: null,
    comparisonPath: null,
  };
  const current = files(currentManifest);
  assert.deepEqual(
    [
      ...(
        await extractUploadArchive(
          await buildPlanArchive(current, currentManifest),
        )
      ).keys(),
    ],
    ["mokly-upload.json", ".mokly-export-artifact"],
  );
});

test("plan requests preserve the endpoint and validate the response", async () => {
  const archive = Buffer.from("plan archive");
  let calls = 0;
  const result = await requestUploadPlan(
    { endpoint, token: "private-token" },
    archive,
    new Set([digestA, digestB]),
    {
      ...retryDependencies,
      fetch: async (url, init) => {
        calls++;
        assert.equal(url, endpoint);
        assert.equal(init?.method, "POST");
        assert.equal(init?.redirect, "manual");
        assert.equal(init?.body, archive);
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("Authorization"), "Bearer private-token");
        assert.equal(headers.get("Content-Type"), "application/gzip");
        assert.equal(headers.get("Accept"), "application/json");
        assert.equal(headers.get("Content-Length"), String(archive.length));
        return Response.json(planResponse());
      },
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(result.missing, [digestA, digestB]);
});

test("plan response failures stay fixed and never echo remote content", async () => {
  for (const response of [
    new Response("private-token", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    }),
    Response.json(planResponse(), { status: 202 }),
    new Response("x".repeat(16 * 1024 * 1024 + 1), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ])
    await assert.rejects(
      requestUploadPlan(
        { endpoint, token: "private-token" },
        Buffer.from("plan"),
        new Set([digestA, digestB]),
        { ...retryDependencies, fetch: async () => response },
      ),
      (error: unknown) => {
        assert.equal((error as { code: string }).code, "upload-failed");
        assert.doesNotMatch(String(error), /private-token/);
        return true;
      },
    );
});

test("plan retries interrupted bodies and fails transport errors safely", async () => {
  let calls = 0;
  const result = await requestUploadPlan(
    { endpoint, token: "private-token" },
    Buffer.from("plan"),
    new Set([digestA, digestB]),
    {
      ...retryDependencies,
      fetch: async () => {
        if (++calls === 1)
          return new Response(
            new ReadableStream({
              pull(controller) {
                controller.error(new Error("interrupted private-token body"));
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        return Response.json(planResponse());
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.upload.id, "upload-1");

  calls = 0;
  await assert.rejects(
    requestUploadPlan(
      { endpoint, token: "private-token" },
      Buffer.from("plan"),
      new Set([digestA, digestB]),
      {
        ...retryDependencies,
        fetch: async () => {
          calls++;
          throw new Error("private-token transport failure");
        },
      },
    ),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "upload-failed");
      assert.equal((error as Error).cause, undefined);
      assert.doesNotMatch(String(error), /private-token/);
      return true;
    },
  );
  assert.equal(calls, 5);
});

test("plan non-retryable statuses fail after one attempt", async () => {
  let calls = 0;
  await assert.rejects(
    requestUploadPlan(
      { endpoint, token: "secret" },
      Buffer.from("plan"),
      new Set([digestA]),
      {
        ...retryDependencies,
        fetch: async () => {
          calls++;
          return new Response(null, { status: 404 });
        },
      },
    ),
    /upload-failed/,
  );
  assert.equal(calls, 1);
});
