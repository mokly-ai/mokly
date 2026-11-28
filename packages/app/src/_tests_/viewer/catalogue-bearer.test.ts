import assert from "node:assert/strict";
import { test } from "node:test";

import type { DetailSource } from "@mokly/viewer";

import { createPublicationAccess } from "../../viewer/access-exchange";
import { catalogueReads } from "../../viewer/catalogue-source.web";

import {
  current,
  guidePath,
  host,
  indexFile,
  indexPath,
  root,
} from "./catalogue-read-fixture";

function entryPath(result: Awaited<ReturnType<DetailSource>>) {
  assert.ok(typeof result === "object" && "entry" in result);
  return result.entry.path;
}

test("concurrent bearer detail retries and frames share the renewed token", async () => {
  const { calls, transport } = host(
    { [indexPath]: indexFile, [guidePath]: current("guide") },
    { [guidePath]: [401, 401] },
  );
  let exchanges = 0;
  let now = 10_000;
  const publication = createPublicationAccess(
    {
      projectId: "project",
      publicationId: "publication",
      origin: root.origin,
    },
    {
      now: () => now,
      issueGrant: async () => ({
        grant: "grant",
        exchangeUrl: new URL("/_access", root).href,
      }),
      transport: async (url, init) => {
        if (url.pathname === "/_access") {
          exchanges += 1;
          return Response.json({ token: `token-${exchanges}`, expiresIn: 300 });
        }
        return new Response(null, {
          status: init.credentials === "include" ? 401 : 200,
        });
      },
    },
  );
  const access = await publication.confirm();
  assert.equal(access.status, "granted");
  assert.equal(access.policy, "bearer");
  assert.deepEqual(await publication.access(), {
    token: "token-1",
    expiresAt: 310_000,
  });

  const reads = catalogueReads(transport);
  const request = { origin: root.origin, access };
  const answer = await reads.index(request);
  assert.ok("index" in answer);
  const detail = reads.detail(() => request, answer.index);
  const details = await Promise.all([detail("guide"), detail("guide")]);
  assert.deepEqual(details.map(entryPath), ["guide", "guide"]);
  assert.equal(exchanges, 2);
  assert.deepEqual(await publication.access(), {
    token: "token-2",
    expiresAt: 310_000,
  });

  now = 190_000;
  assert.deepEqual(await publication.access(), {
    token: "token-3",
    expiresAt: 490_000,
  });
  assert.equal(entryPath(await detail("guide")), "guide");
  assert.deepEqual(calls, [
    { path: indexPath, credentials: "omit", authorization: "Bearer token-1" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-1" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-1" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-2" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-2" },
    { path: guidePath, credentials: "omit", authorization: "Bearer token-3" },
  ]);
});
