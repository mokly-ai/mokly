import assert from "node:assert/strict";
import test from "node:test";

import { uploadMissingBlobs } from "../src/publish/blobs.js";
import { completeUpload } from "../src/publish/complete.js";
import { requestUploadPlan } from "../src/publish/plan.js";

import {
  read,
  protocol,
  exchange,
  sources,
  upload,
  prose,
} from "./helpers/guides_ci_context.js";
import { assertUploadRequest } from "./helpers/upload_request.js";

test("CI code fences never invent a receiver request path", () => {
  assert.equal(sources.size, 5);
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
  const seconds = /times out after (\d+) seconds/u.exec(prose)?.[1];
  assert.ok(seconds);
  assert.ok(exchange.includes(`times out after ${seconds} seconds`));
  const timeout = /AbortSignal\.timeout\(([\d_]+)\)/u.exec(
    read("src/publish/http.ts"),
  )?.[1];
  assert.equal(Number(timeout?.replaceAll("_", "")), Number(seconds) * 1000);
});

test("CI flags and credential sources exist in code and the upload contract", () => {
  const parser = read("src/cli/arguments.ts");
  const help = read("src/cli/help.ts");
  for (const [id, source] of sources) {
    for (const [, flags] of source.matchAll(
      /\bnpx (?:--no-install )?mokly publish([^\n]*)/gu,
    )) {
      for (const [flag] of (flags ?? "").matchAll(/--[a-z]+(?:-[a-z]+)*/gu)) {
        assert.ok(parser.includes(`"${flag}"`), `${id}: ${flag}`);
        assert.ok(
          help.includes(flag) && protocol.includes(flag),
          `${id}: ${flag}`,
        );
      }
    }
  }
  for (const name of ["MOKLY_ENDPOINT", "MOKLY_TOKEN"]) {
    assert.ok(sources.get("ci/publish-from-ci")?.includes(name));
    assert.ok(protocol.includes(name));
    assert.ok(read("src/publish/options.ts").includes(name));
  }
});
