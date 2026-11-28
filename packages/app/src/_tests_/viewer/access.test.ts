import assert from "node:assert/strict";
import { test } from "node:test";

import { currentAccessState, type ScopedAccess } from "../../viewer/access";
import {
  accessStartPath,
  createPublicationAccess,
} from "../../viewer/access-exchange";
import type { CatalogueTransport } from "../../viewer/access-exchange";

const identity = {
  projectId: "project-a",
  publicationId: "publication-a",
  origin: "https://p-a.example",
};

function host({
  cookie = 200,
  start = 200,
  bearer = 200,
  exchange = (number: number): Response | Promise<Response> =>
    Response.json({ token: `token-${number}`, expiresIn: 300 }),
} = {}) {
  const clock = { now: 10_000 };
  const grants: string[][] = [];
  const calls: {
    path: string;
    credentials?: RequestCredentials;
    authorization: string | null;
  }[] = [];
  const transport: CatalogueTransport = async (url, init) => {
    const authorization = new Headers(init.headers).get("authorization");
    calls.push({
      path: url.pathname,
      credentials: init.credentials,
      authorization,
    });
    if (url.pathname === "/_access") return exchange(grants.length);
    if (url.pathname === `/${accessStartPath}`)
      return new Response(null, { status: start });
    assert.equal(url.pathname, "/");
    return new Response(null, {
      status: authorization === null ? cookie : bearer,
    });
  };
  const publication = createPublicationAccess(identity, {
    transport,
    now: () => clock.now,
    issueGrant: async (projectId, publicationId) => {
      grants.push([projectId, publicationId]);
      return { grant: "grant", exchangeUrl: identity.origin + "/_access" };
    },
  });
  return { publication, clock, calls, grants };
}

test("access readiness belongs only to the current source identity", () => {
  const previous: ScopedAccess = {
    key: { ...identity, enabled: true, required: true, attempt: 0 },
    state: {
      status: "granted",
      policy: "cookie",
      publication: host().publication,
    },
  };
  assert.deepEqual(
    currentAccessState(
      { ...previous.key, publicationId: "publication-b" },
      previous,
    ),
    { status: "granting" },
  );
  assert.deepEqual(currentAccessState({ ...previous.key }, previous), {
    status: "granting",
  });
  assert.equal(currentAccessState(previous.key, previous), previous.state);
});

test("a cookie confirmation keeps the token and expiry from its exchange", async () => {
  const { publication, grants, calls } = host({
    exchange: () => Response.json({ token: "kept", expiresIn: 250 }),
  });
  assert.deepEqual(await publication.confirm(), {
    status: "granted",
    policy: "cookie",
    publication,
  });
  assert.deepEqual(await publication.access(), {
    token: "kept",
    expiresAt: 260_000,
  });
  assert.deepEqual(grants, [["project-a", "publication-a"]]);
  assert.deepEqual(calls, [
    { path: "/_access", credentials: "include", authorization: null },
    { path: "/", credentials: "include", authorization: null },
  ]);
});

test("frame access reuses the token above two minutes and renews at or below it", async () => {
  const { publication, clock, grants } = host();
  await publication.confirm();
  clock.now = 189_999;
  assert.deepEqual(await publication.access(), {
    token: "token-1",
    expiresAt: 310_000,
  });
  assert.equal(grants.length, 1);
  clock.now = 190_000;
  assert.deepEqual(await publication.access(), {
    token: "token-2",
    expiresAt: 490_000,
  });
  clock.now = 370_001;
  assert.deepEqual(await publication.access(), {
    token: "token-3",
    expiresAt: 670_001,
  });
  assert.equal(grants.length, 3);
});

test("concurrent frame access calls share one exchange", async () => {
  const exchange = Promise.withResolvers<Response>();
  const { publication, clock, grants } = host({
    exchange: (number) =>
      number === 1
        ? Response.json({ token: "initial", expiresIn: 300 })
        : exchange.promise,
  });
  await publication.confirm();
  clock.now = 190_000;
  const first = publication.access();
  const second = publication.access();
  assert.equal(grants.length, 2);
  exchange.resolve(Response.json({ token: "renewed", expiresIn: 300 }));
  assert.deepEqual(await Promise.all([first, second]), [
    { token: "renewed", expiresAt: 490_000 },
    { token: "renewed", expiresAt: 490_000 },
  ]);
});

test("a frame exchange refusal rejects the call and permits a later exchange", async () => {
  const { publication } = host({
    exchange: (number) =>
      number === 1
        ? new Response(null, { status: 503 })
        : Response.json({ token: "renewed", expiresIn: 300 }),
  });
  await assert.rejects(publication.access(), { name: "ApiError" });
  assert.deepEqual(await publication.access(), {
    token: "renewed",
    expiresAt: 310_000,
  });
});

test("a failed cookie confirmation checks the start page before confirming with the bearer", async () => {
  const { publication, calls } = host({ cookie: 401, start: 503 });
  assert.deepEqual(await publication.confirm(), {
    status: "granted",
    policy: "bearer",
    publication,
  });
  assert.deepEqual(calls, [
    { path: "/_access", credentials: "include", authorization: null },
    { path: "/", credentials: "include", authorization: null },
    {
      path: `/${accessStartPath}`,
      credentials: "omit",
      authorization: "Bearer token-1",
    },
    { path: "/", credentials: "omit", authorization: "Bearer token-1" },
  ]);
});

test("a missing start page blocks before bearer confirmation", async () => {
  const { publication, calls } = host({ cookie: 401, start: 404 });
  assert.deepEqual(await publication.confirm(), { status: "blocked" });
  assert.deepEqual(
    calls.map(({ path }) => path),
    ["/_access", "/", `/${accessStartPath}`],
  );
});

test("a failed bearer confirmation remains retryable", async () => {
  const { publication } = host({ cookie: 401, bearer: 401 });
  assert.equal((await publication.confirm()).status, "refused");
});

test("a tokenless exchange preserves cookie access and refuses bearer access", async () => {
  const cookie = host({ exchange: () => new Response(null, { status: 204 }) });
  assert.equal((await cookie.publication.confirm()).status, "granted");
  assert.deepEqual(await cookie.publication.readCredential("cookie"), {
    init: { credentials: "include" },
    revision: 1,
  });
  await assert.rejects(cookie.publication.access(), { name: "ApiError" });

  const bearer = host({
    cookie: 401,
    exchange: () => Response.json({ token: "invalid token", expiresIn: 300 }),
  });
  assert.equal((await bearer.publication.confirm()).status, "refused");
  assert.deepEqual(
    bearer.calls.map(({ path }) => path),
    ["/_access", "/"],
  );
  await assert.rejects(bearer.publication.readCredential("bearer"), {
    name: "ApiError",
  });
});
