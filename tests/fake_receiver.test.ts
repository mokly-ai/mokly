import assert from "node:assert/strict";
import test from "node:test";

import { bundleUpload } from "../dist/publish/bundle.js";
import type { PlanResponse, UploadManifest } from "../dist/publish/types.js";

import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { parseUniqueJson } from "./helpers/fake_receiver_json.js";
import { ownershipMarkerFromFiles } from "./helpers/ownership_marker.js";

const token = "receiver-secret";

test("fake receiver JSON parsing rejects duplicate keys and non-JSON whitespace", () => {
  assert.throws(() => parseUniqueJson('{"value":1,"value":2}'));
  assert.throws(() => parseUniqueJson('{"value":1,\u00a0"next":2}'));
  assert.equal(Object.getPrototypeOf(parseUniqueJson('{"__proto__":1}')), null);
});

test("fake receiver validates a complete exchange and keeps the first publication", async (context) => {
  const receiver = await startFakeReceiver(context, {
    endpointPath: "/v1/plan?scope=catalogue",
    token,
  });
  const fixture = await currentPlanArchive();
  assert.equal(
    (await plan(receiver.endpoint, fixture.archive, "wrong")).status,
    401,
  );
  assert.equal(
    (await fetch(`${receiver.origin}/v1/plan`, request(fixture.archive)))
      .status,
    404,
  );

  const firstResponse = await plan(receiver.endpoint, fixture.archive);
  assert.equal(firstResponse.status, 200);
  const first = (await firstResponse.json()) as PlanResponse;
  const manifestEntry = fixture.marker.files.find(
    ({ path }) => path === "mokly-upload.json",
  )!;
  assert.equal(receiver.blobs.has(manifestEntry.sha256), true);
  assert.equal(first.missing.includes(manifestEntry.sha256), false);
  assert.deepEqual(first.missing, [...first.missing].sort());

  const badDigest = first.missing[0]!;
  assert.equal(
    (
      await fetch(first.blobUrl.replace("{sha256}", badDigest), {
        method: "PUT",
        headers: blobHeaders(1),
        body: requestBody(Buffer.from("x")),
      })
    ).status,
    400,
  );
  for (const digest of first.missing) {
    const entry = fixture.marker.files.find(({ sha256 }) => sha256 === digest)!;
    const bytes = fixture.files.get(entry.path)!;
    assert.equal(
      (
        await fetch(first.blobUrl.replace("{sha256}", digest), {
          method: "PUT",
          headers: blobHeaders(bytes.length),
          body: requestBody(bytes),
        })
      ).status,
      204,
    );
  }
  const completed = await complete(first.completeUrl);
  assert.equal(completed.status, 201);
  const publication = await completed.json();
  assert.match(publication.viewerUrl, /^http:\/\/127\.0\.0\.1:/u);

  const replay = (await (
    await plan(receiver.endpoint, fixture.archive)
  ).json()) as PlanResponse;
  assert.deepEqual(replay.missing, []);
  const replayed = await complete(replay.completeUrl);
  assert.equal(replayed.status, 200);
  assert.deepEqual(await replayed.json(), publication);
  assert.equal(JSON.stringify(receiver.requests).includes(token), false);
  assert.equal(receiver.requests[1]?.path, "/v1/plan");
  assert.equal(receiver.requests[2]?.path, "/v1/plan?scope=catalogue");
  assert.equal(
    receiver.requests.every(
      ({ headers }) => headers["authorization"] !== `Bearer ${token}`,
    ),
    true,
  );
});

test("fake receiver returns contract statuses for versions, expiry and missing blobs", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const fixture = await currentPlanArchive();
  const oldMarker = await currentPlanArchive({ markerVersion: 1 });
  assert.equal((await plan(receiver.endpoint, oldMarker.archive)).status, 426);
  const newerEnvelope = await currentPlanArchive({ manifestVersion: 2 });
  assert.equal(
    (await plan(receiver.endpoint, newerEnvelope.archive)).status,
    426,
  );
  const duplicateManifest = await currentPlanArchive({
    manifestText: JSON.stringify(fixture.manifest).replace(
      /^\{/u,
      '{"schemaVersion":1,',
    ),
  });
  assert.equal(
    (await plan(receiver.endpoint, duplicateManifest.archive)).status,
    400,
  );
  const mismatchedManifest = await currentPlanArchive({
    corruptManifestDigest: true,
  });
  assert.equal(
    (await plan(receiver.endpoint, mismatchedManifest.archive)).status,
    400,
  );

  receiver.control.expiryMs.push(-1);
  const expired = (await (
    await plan(receiver.endpoint, fixture.archive)
  ).json()) as PlanResponse;
  const expiredDigest = expired.missing[0]!;
  assert.equal(
    (
      await fetch(expired.blobUrl.replace("{sha256}", expiredDigest), {
        method: "PUT",
        headers: blobHeaders(0),
        body: requestBody(Buffer.alloc(0)),
      })
    ).status,
    410,
  );

  const active = (await (
    await plan(receiver.endpoint, fixture.archive)
  ).json()) as PlanResponse;
  assert.equal((await complete(active.completeUrl)).status, 409);
  assert.equal(
    (
      await fetch(active.blobUrl.replace("{sha256}", "f".repeat(64)), {
        method: "PUT",
        headers: blobHeaders(0),
        body: requestBody(Buffer.alloc(0)),
      })
    ).status,
    404,
  );
});

test("fake receiver scripts bounded overrides and tracks concurrent PUTs", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const fixture = await currentPlanArchive();
  receiver.queue("plan", { status: 503, retryAfter: "0", times: 2 });
  for (let index = 0; index < 2; index++) {
    const response = await plan(receiver.endpoint, fixture.archive);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "0");
  }
  const response = await plan(receiver.endpoint, fixture.archive);
  assert.equal(response.status, 200);
  const planned = (await response.json()) as PlanResponse;
  receiver.control.blobDelayMs = 20;
  await Promise.all(
    planned.missing.map((digest) => {
      const entry = fixture.marker.files.find(
        ({ sha256 }) => sha256 === digest,
      )!;
      const bytes = fixture.files.get(entry.path)!;
      return fetch(planned.blobUrl.replace("{sha256}", digest), {
        method: "PUT",
        headers: blobHeaders(bytes.length),
        body: requestBody(bytes),
      });
    }),
  );
  assert.ok(receiver.maxConcurrentPuts > 1);
  receiver.dropBlob(planned.missing[0]!);
  assert.equal((await complete(planned.completeUrl)).status, 409);
});

async function currentPlanArchive(
  options: {
    corruptManifestDigest?: boolean;
    manifestText?: string;
    manifestVersion?: number;
    markerVersion?: number;
  } = {},
) {
  const manifest: UploadManifest = {
    schemaVersion: 1,
    moklyVersion: "1.2.3",
    repository: { host: "github.com", owner: "sample", name: "catalogue" },
    branch: "main",
    headSha: "a".repeat(40),
    baseRef: null,
    baseSha: null,
    pullRequest: null,
    configPath: "mokly.config.ts",
    exportedAt: "2026-09-26T12:00:00.000Z",
    comparisonPath: null,
  };
  const manifestBytes = Buffer.from(
    options.manifestText ??
      `${JSON.stringify({ ...manifest, schemaVersion: options.manifestVersion ?? 1 })}\n`,
  );
  const files = new Map<string, Buffer>([
    ["index.html", Buffer.from("home")],
    ["404.html", Buffer.from("missing")],
    ["mokly-upload.json", manifestBytes],
  ]);
  const marker = ownershipMarkerFromFiles(files);
  if (options.corruptManifestDigest)
    marker.files.find(({ path }) => path === "mokly-upload.json")!.sha256 =
      "0".repeat(64);
  const markerBytes = Buffer.from(
    `${JSON.stringify({ ...marker, schemaVersion: options.markerVersion ?? 2 })}\n`,
  );
  return {
    archive: await bundleUpload(
      new Map([
        ["mokly-upload.json", manifestBytes],
        [".mokly-export-artifact", markerBytes],
      ]),
    ),
    files,
    manifest,
    marker,
  };
}

function request(body: Buffer): RequestInit {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/gzip",
      Accept: "application/json",
      "Content-Length": String(body.length),
    },
    body: requestBody(body),
  };
}

function plan(endpoint: string, body: Buffer, credential = token) {
  const init = request(body);
  (init.headers as Record<string, string>)["Authorization"] =
    `Bearer ${credential}`;
  return fetch(endpoint, init);
}

function blobHeaders(size: number): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
    "Content-Length": String(size),
  };
}

function complete(url: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Length": "0",
    },
  });
}

function requestBody(bytes: Buffer): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(bytes.length);
  body.set(bytes);
  return body;
}
