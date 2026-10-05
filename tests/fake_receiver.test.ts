import assert from "node:assert/strict";
import test from "node:test";

import type { PlanResponse } from "../dist/publish/types.js";

import { startFakeReceiver } from "./helpers/fake_receiver.js";
import {
  fakeBlobHeaders,
  fakeCompleteRequest,
  fakePlanArchive,
  fakePlanRequest,
  fakeRequestBody,
} from "./helpers/fake_receiver_fixture.js";
import { parseUniqueJson } from "./helpers/fake_receiver_json.js";

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
  const fixture = await fakePlanArchive();
  assert.equal(
    (await fakePlanRequest(receiver.endpoint, fixture.archive, "wrong")).status,
    401,
  );
  assert.equal(
    (
      await fakePlanRequest(
        `${receiver.origin}/v1/plan`,
        fixture.archive,
        token,
      )
    ).status,
    404,
  );

  const firstResponse = await fakePlanRequest(
    receiver.endpoint,
    fixture.archive,
    token,
  );
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
        headers: fakeBlobHeaders(1, token),
        body: fakeRequestBody(Buffer.from("x")),
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
          headers: fakeBlobHeaders(bytes.length, token),
          body: fakeRequestBody(bytes),
        })
      ).status,
      204,
    );
  }
  const completed = await fakeCompleteRequest(first.completeUrl, token);
  assert.equal(completed.status, 201);
  const publication = await completed.json();
  assert.match(publication.viewerUrl, /^http:\/\/127\.0\.0\.1:/u);

  const replay = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  assert.deepEqual(replay.missing, []);
  const replayed = await fakeCompleteRequest(replay.completeUrl, token);
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
  const fixture = await fakePlanArchive();
  const oldMarker = await fakePlanArchive({ markerVersion: 1 });
  assert.equal(
    (await fakePlanRequest(receiver.endpoint, oldMarker.archive, token)).status,
    426,
  );
  for (const manifestVersion of [1, 3]) {
    const otherEnvelope = await fakePlanArchive({ manifestVersion });
    assert.equal(
      (await fakePlanRequest(receiver.endpoint, otherEnvelope.archive, token))
        .status,
      426,
    );
  }
  const duplicateManifest = await fakePlanArchive({
    manifestText: JSON.stringify(fixture.manifest).replace(
      /^\{/u,
      '{"schemaVersion":2,',
    ),
  });
  assert.equal(
    (await fakePlanRequest(receiver.endpoint, duplicateManifest.archive, token))
      .status,
    400,
  );
  const mismatchedManifest = await fakePlanArchive({
    corruptManifestDigest: true,
  });
  assert.equal(
    (
      await fakePlanRequest(
        receiver.endpoint,
        mismatchedManifest.archive,
        token,
      )
    ).status,
    400,
  );
  const tooLargeMarker = await fakePlanArchive({
    markerSize: 64 * 1024 * 1024 + 1,
  });
  assert.equal(
    (await fakePlanRequest(receiver.endpoint, tooLargeMarker.archive, token))
      .status,
    413,
  );

  receiver.control.expiryMs.push(-1);
  const expired = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  const expiredDigest = expired.missing[0]!;
  assert.equal(
    (
      await fetch(expired.blobUrl.replace("{sha256}", expiredDigest), {
        method: "PUT",
        headers: fakeBlobHeaders(0, token),
        body: fakeRequestBody(Buffer.alloc(0)),
      })
    ).status,
    410,
  );

  const active = (await (
    await fakePlanRequest(receiver.endpoint, fixture.archive, token)
  ).json()) as PlanResponse;
  assert.equal(
    (await fakeCompleteRequest(active.completeUrl, token)).status,
    409,
  );
  assert.equal(
    (
      await fetch(active.blobUrl.replace("{sha256}", "f".repeat(64)), {
        method: "PUT",
        headers: fakeBlobHeaders(0, token),
        body: fakeRequestBody(Buffer.alloc(0)),
      })
    ).status,
    404,
  );
});

test("fake receiver scripts bounded overrides and tracks concurrent PUTs", async (context) => {
  const receiver = await startFakeReceiver(context, { token });
  const fixture = await fakePlanArchive();
  receiver.queue("plan", { status: 503, retryAfter: "0", times: 2 });
  for (let index = 0; index < 2; index++) {
    const response = await fakePlanRequest(
      receiver.endpoint,
      fixture.archive,
      token,
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "0");
  }
  const response = await fakePlanRequest(
    receiver.endpoint,
    fixture.archive,
    token,
  );
  assert.equal(response.status, 200);
  const planned = (await response.json()) as PlanResponse;
  const location = `${receiver.origin}/redirect-target`;
  receiver.queue("plan", {
    status: 302,
    headers: { Location: location },
  });
  const redirected = await fakePlanRequest(
    receiver.endpoint,
    fixture.archive,
    token,
  );
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.get("Location"), location);
  receiver.control.blobDelayMs = 20;
  await Promise.all(
    planned.missing.map((digest) => {
      const entry = fixture.marker.files.find(
        ({ sha256 }) => sha256 === digest,
      )!;
      const bytes = fixture.files.get(entry.path)!;
      return fetch(planned.blobUrl.replace("{sha256}", digest), {
        method: "PUT",
        headers: fakeBlobHeaders(bytes.length, token),
        body: fakeRequestBody(bytes),
      });
    }),
  );
  assert.ok(receiver.maxConcurrentPuts > 1);
  receiver.dropBlob(planned.missing[0]!);
  assert.equal(
    (await fakeCompleteRequest(planned.completeUrl, token)).status,
    409,
  );
});
