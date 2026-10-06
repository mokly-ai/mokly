import assert from "node:assert/strict";
import test from "node:test";

import { uploadMissingBlobs } from "../packages/mokly/src/publish/blobs.js";
import { completeUpload } from "../packages/mokly/src/publish/complete.js";
import { requestUploadPlan } from "../packages/mokly/src/publish/plan.js";
import {
  MAX_REQUEST_ATTEMPTS,
  MAX_RETRY_AFTER_SECONDS,
  RETRY_BASE_DELAY_MS,
} from "../packages/mokly/src/publish/retry.js";

import {
  read,
  exchange,
  upload,
  prose,
  fenceHeaders,
  numberWord,
} from "./helpers/guides_ci.js";
import { assertUploadRequest } from "./helpers/upload_request.js";

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

test("receiver limits, stored blobs and plan URL protocols are unambiguous", () => {
  for (const source of [exchange, prose]) {
    assert.match(source, /unfinished/u);
    assert.match(source, /1,024 UTF-8 bytes/u);
    assert.match(source, /`413`|413/u);
    assert.match(source, /`400` or `422`|400\/422/u);
  }
  assert.match(exchange, /absolute `http:` or\s+`https:` URLs/u);
  assert.match(exchange, /`blob:`, `data:`, `file:`/u);
  assert.match(prose, /`blob:` and other\s+schemes are refused/u);
});

test("documented retries agree with the protocol", () => {
  const attemptWord = numberWord(MAX_REQUEST_ATTEMPTS);
  for (const source of [prose, exchange]) {
    assert.match(source, /408/u);
    for (const status of ["429", "500", "502", "503", "504"])
      assert.ok(source.includes(status), status);
    assert.ok(source.includes(attemptWord));
    assert.match(source, /Retry-After/u);
    assert.match(source, /expir/u);
  }
  const retrySource = read("src/publish/retry.ts");
  const waits = Array.from(
    { length: MAX_REQUEST_ATTEMPTS - 1 },
    (_, index) => (RETRY_BASE_DELAY_MS * 2 ** index) / 1_000,
  );
  assert.deepEqual(waits, [1, 2, 4, 8]);
  const waitWording = `${waits.slice(0, -1).join(", ")} and ${waits.at(-1)} seconds`;
  for (const source of [prose, exchange])
    assert.ok(source.includes(waitWording));
  assert.doesNotMatch(retrySource, /16_?000|Math\.min/u);
  assert.doesNotMatch(prose, /sixteen seconds/u);
  assert.doesNotMatch(exchange, /16 s/u);
  assert.ok(
    prose.includes(`up to ${numberWord(MAX_RETRY_AFTER_SECONDS)} seconds`),
  );
  assert.ok(
    exchange.includes(`from 0 through ${MAX_RETRY_AFTER_SECONDS} seconds`),
  );
  assert.match(prose, /plans once more/u);
  assert.match(exchange, /one fresh Plan/u);
  assert.match(prose, /second `409` or `410` fails/u);
  assert.match(
    exchange,
    /A second `409`,\s+`410`, or local expiry is `upload-failed`/u,
  );
  assert.match(prose, /already published for this commit/u);
  assert.match(exchange, /already published for this commit/u);
  assert.match(prose, /Any other `2xx` fails/u);
  assert.match(exchange, /Any other 2xx is `upload-failed`/u);
});
