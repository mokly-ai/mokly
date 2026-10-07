import assert from "node:assert/strict";
import test from "node:test";

import { createCacheHandler } from "../scripts/turbo-cache/artifacts.js";
import { authenticate, authorize } from "../scripts/turbo-cache/auth.js";
import { CacheError } from "../scripts/turbo-cache/errors.js";

import {
  MemoryArtifactStore,
  cacheBindings,
  cacheRequest,
} from "./helpers/turbo_cache.js";

test("cache principals accept only their namespace and PR fallback order", async () => {
  for (const principal of ["trusted", "pr", "reader"] as const) {
    const request = cacheRequest("/v8/artifacts/status", {
      principal,
      team: principal === "pr" ? "mokly-pr-1" : "mokly",
    });
    const identity = await authenticate(request, cacheBindings, () => {});
    const access = authorize(
      new URL(request.url),
      identity.principal,
      identity.team,
    );
    assert.deepEqual(
      access.readNamespaces,
      principal === "pr" ? ["mokly-pr-1", "mokly"] : ["mokly"],
    );
  }
  for (const team of [
    "mokly",
    "other-pr-1",
    "mokly-pr-0",
    "mokly-pr-01",
    "mokly-pr--1",
    "mokly-pr-1.5",
    "mokly-pr-",
    "mokly-pr-123456789012345678901",
  ])
    assert.throws(
      () =>
        authorize(
          new URL(`https://cache.example/?slug=${team}`),
          "pr-writer",
          "mokly",
        ),
      { status: 403 },
    );
  for (const principal of ["trusted-writer", "reader"] as const)
    assert.throws(
      () =>
        authorize(
          new URL("https://cache.example/?slug=mokly-pr-1"),
          principal,
          "mokly",
        ),
      { status: 403 },
    );
});

test("team query aliases reject missing, duplicate, and contradictory values", () => {
  for (const query of [
    "",
    "slug=",
    "slug=mokly&slug=mokly",
    "teamId=mokly&teamId=mokly",
    "slug=mokly&teamId=other",
  ])
    assert.throws(
      () =>
        authorize(
          new URL(`https://cache.example/?${query}`),
          "trusted-writer",
          "mokly",
        ),
      { status: 403 },
    );
  for (const query of [
    "slug=mokly",
    "teamId=mokly",
    "slug=mokly&teamId=mokly",
    "slug=mokly&unrelated=1",
  ])
    assert.equal(
      authorize(
        new URL(`https://cache.example/?${query}`),
        "trusted-writer",
        "mokly",
      ).namespace,
      "mokly",
    );
});

test("invalid configuration fails closed, including duplicate disabled secrets", async () => {
  const request = cacheRequest();
  for (const team of [
    undefined,
    "",
    "../mokly",
    "-mokly",
    "mokly-",
    "Mokly",
    "a".repeat(65),
  ]) {
    const bindings = { ...cacheBindings };
    if (team === undefined) delete bindings.TURBO_CACHE_TEAM;
    else bindings.TURBO_CACHE_TEAM = team;
    await assert.rejects(
      authenticate(request, bindings, () => {}),
      { status: 500, code: "configuration_error" },
    );
  }
  for (const token of ["short", cacheBindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN!])
    await assert.rejects(
      authenticate(
        request,
        {
          ...cacheBindings,
          TURBO_CACHE_TRUSTED_WRITE_TOKEN: token,
          TURBO_CACHE_PR_WRITE_TOKEN: token,
        },
        () => {},
      ),
      { status: 500, code: "configuration_error" },
    );
});

test("configuration 500s log the failed check without exposing configuration values", async () => {
  const missing = { ...cacheBindings };
  delete missing.TURBO_CACHE_TEAM;
  const invalid = {
    ...cacheBindings,
    TURBO_CACHE_TEAM: "../private-team-marker",
  };
  const duplicate = {
    ...cacheBindings,
    TURBO_CACHE_PR_WRITE_TOKEN: cacheBindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN!,
  };
  for (const [bindings, reason] of [
    [missing, "missing TURBO_CACHE_TEAM"],
    [{ ...cacheBindings, TURBO_CACHE_TEAM: "" }, "missing TURBO_CACHE_TEAM"],
    [invalid, "invalid TURBO_CACHE_TEAM"],
    [duplicate, "duplicate configured secrets"],
    [
      { ...duplicate, TURBO_CACHE_TEAM: invalid.TURBO_CACHE_TEAM },
      "duplicate configured secrets; invalid TURBO_CACHE_TEAM",
    ],
  ] as const) {
    const messages: string[] = [];
    const handle = createCacheHandler(
      new MemoryArtifactStore(),
      bindings,
      (message) => {
        messages.push(message);
      },
    );
    for (const method of ["GET", "HEAD"]) {
      const response = await handle(cacheRequest(undefined, { method }));
      assert.equal(response.status, 500);
      if (method === "HEAD") assert.equal(response.body, null);
      else {
        const detail = {
          code: "configuration_error",
          message: "Cache configuration is invalid.",
        };
        assert.deepEqual(await response.json(), { ...detail, error: detail });
      }
    }
    assert.deepEqual(
      messages,
      Array(2).fill(`Error: Cache configuration failed: ${reason}.`),
    );
    for (const value of Object.values(bindings).filter(Boolean))
      assert.ok(messages.every((message) => !message.includes(value!)));
    assert.ok(messages.every((message) => !/\d/u.test(message)));
  }
});

test("empty and short secrets disable principals without exposing values", async () => {
  for (const token of ["", "x".repeat(31)]) {
    const warnings: string[] = [];
    const bindings = {
      ...cacheBindings,
      TURBO_CACHE_TRUSTED_WRITE_TOKEN: token,
    };
    const request = cacheRequest(undefined, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await assert.rejects(
      authenticate(request, bindings, (message) => warnings.push(message)),
      { status: 401 },
    );
    assert.equal(warnings.length, token ? 1 : 0);
    if (token) assert.ok(!warnings.join().includes(token));
    assert.equal(
      (
        await authenticate(
          cacheRequest(undefined, { principal: "reader" }),
          bindings,
          () => {},
        )
      ).principal,
      "reader",
    );
  }
  const token = "é".repeat(16);
  assert.equal(
    (
      await authenticate(
        cacheRequest(undefined, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { ...cacheBindings, TURBO_CACHE_TRUSTED_WRITE_TOKEN: token },
        () => {},
      )
    ).principal,
    "trusted-writer",
  );
});

test("unknown and malformed bearer values are unauthorized", async () => {
  for (const value of [
    "",
    "unknown",
    "Basic abc",
    "Bearer wrong",
    "Bearer one, Bearer two",
    "Bearer token space",
  ])
    await assert.rejects(
      authenticate(
        cacheRequest(undefined, { headers: { Authorization: value } }),
        cacheBindings,
        () => {},
      ),
      (error) => error instanceof CacheError && error.status === 401,
    );
});

test("every request hashes all configured secrets regardless of bearer position", async (context) => {
  const subtle = crypto.subtle;
  const original = subtle.digest.bind(subtle);
  const descriptor = Object.getOwnPropertyDescriptor(subtle, "digest");
  const inputs: string[] = [];
  Object.defineProperty(subtle, "digest", {
    configurable: true,
    value: (algorithm: AlgorithmIdentifier, input: BufferSource) => {
      inputs.push(new TextDecoder().decode(input));
      return original(algorithm, input);
    },
  });
  context.after(() => {
    if (descriptor) Object.defineProperty(subtle, "digest", descriptor);
    else Reflect.deleteProperty(subtle, "digest");
  });
  for (const principal of ["trusted", "pr", "reader"] as const) {
    inputs.length = 0;
    await authenticate(
      cacheRequest(undefined, { principal }),
      cacheBindings,
      () => {},
    );
    assert.equal(inputs.length, 4);
    assert.deepEqual(inputs.slice(1), [
      cacheBindings.TURBO_CACHE_TRUSTED_WRITE_TOKEN,
      cacheBindings.TURBO_CACHE_PR_WRITE_TOKEN,
      cacheBindings.TURBO_CACHE_READ_TOKEN,
    ]);
  }
  inputs.length = 0;
  await assert.rejects(
    authenticate(new Request("https://cache.example"), cacheBindings, () => {}),
    { status: 401 },
  );
  assert.equal(inputs.length, 4);
});
