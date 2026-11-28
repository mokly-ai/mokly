import assert from "node:assert/strict";
import { test } from "node:test";

import { createPublicationAccess } from "../../viewer/access-exchange";
import type { CatalogueTransport } from "../../viewer/access-exchange";
import { catalogueReads } from "../../viewer/catalogue-source.web";
import type { SourceAccess } from "../../viewer/source-store";

import {
  current,
  guidePath,
  host,
  indexFile,
  indexPath,
  root,
} from "./catalogue-read-fixture";

function exchangeResponse(number: number) {
  return Response.json({ token: `token-${number}`, expiresIn: 300 });
}

async function confirmedBearer(
  exchange: (number: number) => Response | Promise<Response> = exchangeResponse,
) {
  let exchanges = 0;
  const clock = { now: 10_000 };
  const publication = createPublicationAccess(
    {
      projectId: "project",
      publicationId: "publication",
      origin: root.origin,
    },
    {
      now: () => clock.now,
      issueGrant: async () => ({
        grant: "grant",
        exchangeUrl: new URL("/_access", root).href,
      }),
      transport: async (url, init) => {
        if (url.pathname === "/_access") return exchange(++exchanges);
        return new Response(null, {
          status: init.credentials === "include" ? 401 : 200,
        });
      },
    },
  );
  const access = await publication.confirm();
  assert.equal(access.status, "granted");
  assert.equal(access.policy, "bearer");
  return { publication, access, clock, exchanges: () => exchanges };
}

async function guideReader(
  access: SourceAccess,
  transport: CatalogueTransport,
) {
  const reads = catalogueReads(transport);
  const request = { origin: root.origin, access };
  const answer = await reads.index(request);
  assert.ok("index" in answer);
  const read = reads.detail(request.origin, answer.index);
  return (path: string) => read(access, path);
}

test("concurrent bearer detail retries and frames share the renewed token", async () => {
  const { calls, transport } = host(
    { [indexPath]: indexFile, [guidePath]: current("guide") },
    { [guidePath]: [401, 401] },
  );
  const renewal = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  const { publication, access, clock, exchanges } = await confirmedBearer(
    (number) => {
      if (number === 1) return exchangeResponse(number);
      if (number === 2) {
        started.resolve();
        return renewal.promise;
      }
      return exchangeResponse(number);
    },
  );
  assert.deepEqual(await publication.access(), {
    token: "token-1",
    expiresAt: 310_000,
  });

  const detail = await guideReader(access, transport);
  const reading = Promise.all([detail("guide"), detail("guide")]);
  await started.promise;
  renewal.resolve(exchangeResponse(2));
  const details = await reading;
  assert.deepEqual(
    details.map(({ entry }) => entry.path),
    ["guide", "guide"],
  );
  assert.equal(exchanges(), 2);
  assert.deepEqual(await publication.access(), {
    token: "token-2",
    expiresAt: 310_000,
  });

  clock.now = 190_000;
  assert.deepEqual(await publication.access(), {
    token: "token-3",
    expiresAt: 490_000,
  });
  assert.equal((await detail("guide")).entry.path, "guide");
  assert.deepEqual(calls, [
    { path: indexPath, credentials: "omit", authorization: "Bearer token-1" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-1" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-1" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-2" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-2" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-3" },
  ]);
});

test("a bearer read renews after a successful exchange lost its token body", async () => {
  const { publication, access, clock, exchanges } = await confirmedBearer(
    (number) =>
      number === 2
        ? new Response(null, { status: 200 })
        : exchangeResponse(number),
  );
  clock.now = 190_000;
  await assert.rejects(publication.access(), { name: "ApiError" });
  assert.equal(exchanges(), 2);

  const { calls, transport } = host({ [indexPath]: indexFile });
  const request = { origin: root.origin, access };
  await assert.doesNotReject(catalogueReads(transport).index(request));
  assert.equal(exchanges(), 3);
  assert.deepEqual(calls, [
    { path: indexPath, credentials: "omit", authorization: "Bearer token-3" },
  ]);
});

test("a bearer read renews an expired token before sending the request", async () => {
  const { access, clock, exchanges } = await confirmedBearer();
  const { calls, transport } = host({ [indexPath]: indexFile });
  const reads = catalogueReads(transport);
  const request = { origin: root.origin, access };
  clock.now = 190_000;
  await reads.index(request);
  assert.equal(
    exchanges(),
    1,
    "the read can use a token with two minutes left",
  );

  clock.now = 310_000;
  await reads.index(request);
  assert.equal(exchanges(), 2);
  assert.deepEqual(calls, [
    { path: indexPath, credentials: "omit", authorization: "Bearer token-1" },
    { path: indexPath, credentials: "omit", authorization: "Bearer token-2" },
  ]);
});

test("a late bearer 401 renews again and retries with the new token", async () => {
  const { access, exchanges } = await confirmedBearer();
  const { calls, transport } = host(
    { [indexPath]: indexFile, [guidePath]: current("guide") },
    { [guidePath]: [401, 401] },
  );
  const arrived = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  let firstDetail = true;
  const detail = await guideReader(access, async (url, init) => {
    const answer = await transport(url, init);
    if (url.pathname === guidePath && firstDetail) {
      firstDetail = false;
      arrived.resolve();
      await held.promise;
    }
    return answer;
  });

  const slow = detail("guide");
  await arrived.promise;
  try {
    assert.equal((await detail("guide")).entry.path, "guide");
    assert.equal(exchanges(), 2);
  } finally {
    held.resolve();
  }
  assert.equal((await slow).entry.path, "guide");
  assert.equal(exchanges(), 3);
  assert.deepEqual(
    calls.map(({ authorization }) => authorization),
    [
      "Bearer token-1",
      "Bearer token-1",
      "Bearer token-1",
      "Bearer token-2",
      "Bearer token-3",
    ],
  );
});

test("a late bearer 401 renews once and retries after the token body was lost", async () => {
  const { publication, access, clock, exchanges } = await confirmedBearer(
    (number) =>
      number === 2
        ? new Response(null, { status: 200 })
        : exchangeResponse(number),
  );
  const { calls, transport } = host(
    { [indexPath]: indexFile, [guidePath]: current("guide") },
    { [guidePath]: [401] },
  );
  const arrived = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  let firstDetail = true;
  const detail = await guideReader(access, async (url, init) => {
    const answer = await transport(url, init);
    if (url.pathname === guidePath && firstDetail) {
      firstDetail = false;
      arrived.resolve();
      await held.promise;
    }
    return answer;
  });

  const slow = detail("guide");
  await arrived.promise;
  // Another caller renews while the read waits, and that body is lost.
  clock.now = 190_000;
  await assert.rejects(publication.access(), { name: "ApiError" });
  assert.equal(exchanges(), 2);
  held.resolve();

  assert.equal((await slow).entry.path, "guide");
  assert.equal(exchanges(), 3);
  assert.deepEqual(
    calls.map(({ authorization }) => authorization),
    ["Bearer token-1", "Bearer token-1", "Bearer token-3"],
  );
});
