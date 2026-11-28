import assert from "node:assert/strict";
import { test } from "node:test";

import { createPublicationAccess } from "../../viewer/access-exchange";
import type { CatalogueTransport } from "../../viewer/access-exchange";
import { detailSource } from "../../viewer/catalogue-source.web";

import {
  current,
  guidePath,
  packagedIndex,
  response,
  root,
} from "./catalogue-read-fixture";

test("a late cookie 401 renews again after clearing the renewed cookie", async () => {
  const arrived = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  const sentCookies: (string | undefined)[] = [];
  const clearedCookies: (string | undefined)[] = [];
  let browserCookie: string | undefined;
  let acceptedCookie: string | undefined;
  let exchanges = 0;

  const transport: CatalogueTransport = async (url, init) => {
    assert.equal(init.credentials, "include");
    if (url.pathname === "/_access") {
      const token = `cookie-${++exchanges}`;
      acceptedCookie = token;
      browserCookie = token;
      return Response.json({ token, expiresIn: 300 });
    }

    const sent = browserCookie;
    const authorized = sent !== undefined && sent === acceptedCookie;
    if (url.pathname === "/") {
      return new Response(null, { status: authorized ? 200 : 401 });
    }
    assert.equal(url.pathname, guidePath);
    sentCookies.push(sent);
    if (authorized) return response(url.href, 200, current("guide"));

    if (sent !== undefined) {
      if (sentCookies.length === 1) {
        arrived.resolve();
        await held.promise;
      }
      // The browser applies the 401's clearing header when the reply arrives.
      clearedCookies.push(browserCookie);
      browserCookie = undefined;
    }
    return response(url.href, 401, {});
  };
  const publication = createPublicationAccess(
    { projectId: "project", publicationId: "publication", origin: root.origin },
    {
      now: () => 10_000,
      issueGrant: async () => ({
        grant: "grant",
        exchangeUrl: new URL("/_access", root).href,
      }),
      transport,
    },
  );
  const access = await publication.confirm();
  assert.equal(access.status, "granted");
  assert.equal(access.policy, "cookie");
  const read = detailSource({ root, index: await packagedIndex(), transport });

  // The host rejects the original cookie while the browser still holds it.
  acceptedCookie = undefined;
  const late = read(access, "guide");
  await arrived.promise;
  try {
    assert.equal((await read(access, "guide")).entry.path, "guide");
    assert.equal(exchanges, 2);
    assert.equal(browserCookie, "cookie-2");
  } finally {
    held.resolve();
  }

  await assert.doesNotReject(late, "the late 401 needs a fresh cookie");
  assert.equal((await late).entry.path, "guide");
  assert.equal(exchanges, 3);
  assert.deepEqual(clearedCookies, ["cookie-1", "cookie-2"]);
  assert.deepEqual(sentCookies, [
    "cookie-1",
    "cookie-1",
    "cookie-2",
    "cookie-3",
  ]);
});
