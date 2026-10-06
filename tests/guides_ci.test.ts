import assert from "node:assert/strict";
import test from "node:test";

import { uploadMissingBlobs } from "../src/publish/blobs.js";
import { completeUpload } from "../src/publish/complete.js";
import { requestUploadPlan } from "../src/publish/plan.js";

import {
  exchange,
  prose,
  read,
  recovery,
  sources,
  terminal,
  upload,
} from "./helpers/guides_ci.js";
import { assertUploadRequest } from "./helpers/upload_request.js";

test("CI code fences never invent a receiver request path", () => {
  assert.equal(sources.size, 5);
  assert.match(
    exchange,
    /POST to the exact configured endpoint, preserving its path and query string without appending anything/u,
  );
  assert.match(prose, /exact endpoint/u);
  assert.match(prose, /path is never extended/u);
  for (const [id, source] of sources) {
    for (const [, fence] of source.matchAll(/```[^\n]*\n([\s\S]*?)```/gu))
      assert.doesNotMatch(
        fence ?? "",
        /^\s*(?:POST|PUT|GET|PATCH|DELETE)\s+\S+/mu,
        id,
      );
  }
});

function fenceHeaders(source: string): Array<Record<string, string>> {
  return [...source.matchAll(/```http\n([\s\S]*?)```/gu)].map(([, body]) =>
    Object.fromEntries(
      [...(body ?? "").matchAll(/^([A-Za-z-]+): (.+)$/gmu)].map(
        ([, key, value]) => [key ?? "", value ?? ""],
      ),
    ),
  );
}

test("documented request headers and acceptance match the transport", async () => {
  const endpoint = "https://example.com/receiver?project=team";
  const fences = fenceHeaders(upload);
  assert.equal(fences.length, 3);
  const [plan, blob, complete] = fences;
  assert.deepEqual(plan, {
    Authorization: "Bearer TOKEN",
    "Content-Type": "application/gzip",
    Accept: "application/json",
    "Content-Length": "<bytes>",
  });
  assert.deepEqual(blob, {
    Authorization: "Bearer TOKEN",
    "Content-Type": "application/octet-stream",
    "Content-Length": "<size from the marker>",
  });
  assert.deepEqual(complete, {
    Authorization: "Bearer TOKEN",
    Accept: "application/json",
    "Content-Length": "0",
  });
  const protocolFences = fenceHeaders(
    read("docs/protocol/mokly-upload-exchange.md"),
  );
  assert.deepEqual(protocolFences, fences);
  const retry = {
    now: () => new Date("2026-09-26T12:00:00.000Z"),
    random: () => 0,
    sleep: async () => undefined,
  };
  const digest = "a".repeat(64);
  const selectedPlan = await requestUploadPlan(
    { endpoint, token: "TOKEN" },
    Buffer.from("archive"),
    new Set([digest]),
    {
      ...retry,
      fetch: async (url, init) => {
        assert.equal(url, endpoint);
        const headers = assertUploadRequest(init, "POST", "TOKEN");
        for (const [key, value] of Object.entries(plan ?? {}).filter(
          ([key]) => key !== "Content-Length",
        ))
          assert.equal(headers.get(key), value);
        return Response.json({
          schemaVersion: 1,
          upload: {
            id: "upload",
            expiresAt: "2026-09-26T13:00:00.000Z",
          },
          missing: [digest],
          blobUrl: "https://example.com/blobs/{sha256}",
          completeUrl: "https://example.com/complete",
        });
      },
    },
  );
  await uploadMissingBlobs(
    selectedPlan,
    new Map([[digest, { sha256: digest, size: 1, bytes: Buffer.from("a") }]]),
    { endpoint, token: "TOKEN" },
    1,
    {
      ...retry,
      fetch: async (_url, init) => {
        const headers = assertUploadRequest(init, "PUT", "TOKEN");
        for (const [key, value] of Object.entries(blob ?? {}).filter(
          ([key]) => key !== "Content-Length",
        ))
          assert.equal(headers.get(key), value);
        return new Response(null, { status: 204 });
      },
    },
  );
  await completeUpload(
    selectedPlan,
    { endpoint, token: "TOKEN" },
    {
      ...retry,
      fetch: async (_url, init) => {
        const headers = assertUploadRequest(init, "POST", "TOKEN");
        for (const [key, value] of Object.entries(complete ?? {}))
          assert.equal(headers.get(key), value);
        return new Response(null, { status: 201 });
      },
    },
  );
  assert.match(prose, /Any `2xx` answer means the file is stored/u);
  assert.match(exchange, /Any 2xx means stored/u);
  assert.match(prose, /`201` means this upload created the publication/u);
  assert.match(exchange, /`201` means this upload created/u);
  assert.match(prose, /none follows a redirect/u);
  assert.match(exchange, /follows no redirect/u);
  const seconds = /times out after (\d+) seconds/u.exec(prose)?.[1];
  assert.ok(seconds);
  assert.ok(exchange.includes(`times out after ${seconds} seconds`));
  const timeout = /AbortSignal\.timeout\(([\d_]+)\)/u.exec(
    read("src/publish/http.ts"),
  )?.[1];
  assert.equal(Number(timeout?.replaceAll("_", "")), Number(seconds) * 1000);
});

test("Complete idempotency, accounting and cancellation copy stay explicit", () => {
  assert.match(
    exchange,
    /Repeating Complete for that upload returns the same status and body and never creates another publication/u,
  );
  assert.match(
    prose,
    /Repeating Complete for that upload returns its first status and body and never publishes again/u,
  );
  assert.match(exchange, /`200` means a different upload already completed/u);
  assert.match(prose, /`200` means a different upload already completed/u);
  for (const source of [exchange, prose]) {
    assert.match(source, /Plan(?:-| )archive/u);
    assert.match(source, /Uploading 0 of 1 file/u);
    assert.match(source, /empty `missing`/u);
    assert.match(source, /Publication was cancelled/u);
  }
  assert.match(exchange, /first publish to an empty receiver.*`0 unchanged`/u);
  assert.match(exchange, /entries sharing one digest each count/u);
  assert.match(exchange, /Blob PUT attempt in any round/u);
  assert.match(exchange, /marker's own byte length participates/u);
  assert.match(
    exchange,
    /The catalogue upload did not complete\. Check the endpoint and connection, then retry/u,
  );
  assert.match(
    exchange,
    /The only signal-based exception is the \[pre-installation window\]\(\.\/mokly-export-recovery\.md#pre-installation-window\)/u,
  );
  assert.match(
    exchange,
    /Outside that window, never infer cancellation from a cause chain, `AggregateError` members, error text or an already-aborted command signal/u,
  );
  assert.match(
    exchange,
    /prints every other error unchanged with that error's own category/u,
  );
  assert.match(
    terminal,
    /exchange cancellation rule.*decides whether a publish failure is a cancellation or another error/u,
  );
  assert.match(
    recovery,
    /restoring the previous export fails, `mokly publish` prints the export rollback error naming the retained backup/u,
  );
  assert.match(
    recovery,
    /lets the event loop complete one full turn that includes an I\/O poll, then checks once more/u,
  );
  assert.match(recovery, /uses no wall-clock delay/u);
  for (const phase of [
    "changed-path evidence",
    "Comparison generation",
    "Changes calculation",
    "removed-page preview",
  ])
    assert.ok(recovery.includes(phase), phase);
  assert.match(
    recovery,
    /keeps the original error object, class, fields, message and stack/u,
  );
  assert.match(recovery, /`MOKLY_DIAGNOSTIC=1`.*stack/u);
  assert.match(
    recovery,
    /hold a referenced Node handle.*esbuild startup.*status 1/u,
  );
  assert.match(
    prose,
    /could not put your previous export back.*recovery error.*folder to recover/u,
  );
});
