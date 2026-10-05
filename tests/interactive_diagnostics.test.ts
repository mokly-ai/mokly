import assert from "node:assert/strict";
import test from "node:test";

import { INTERACTIVE_DIAGNOSTIC_BODY_LIMIT } from "../dist/interactive/diagnostics.js";

import {
  interactiveServerFixture,
  removeInteractiveFixture,
} from "./helpers/interactive_server.js";

test("Live diagnostics validate, cap and log once per view generation", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const endpoint = `${live.liveUrl}/__mokly/interactive/${live.generation}/diagnostics`;
  const diagnostic = {
    code: "render-error",
    colorScheme: "light",
    entryPath: "home",
    entryKind: "screen",
    message: "consumer\nrender failed",
    viewport: "mobile",
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await post(endpoint, diagnostic);
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assertPolicyHeaders(response);
  }
  assert.deepEqual(live.diagnostics, [
    `[mokly/render-error] ${live.generation} home mobile/light: consumer render failed`,
  ]);

  const invalid = await post(endpoint, {
    ...diagnostic,
    consumerSecret: "must not echo",
  });
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(await invalid.text(), /must not echo/);
  assert.equal((await fetch(endpoint, { method: "GET" })).status, 405);
  assert.equal(
    (
      await post(
        `${live.liveUrl}/__mokly/interactive/${"f".repeat(32)}/diagnostics`,
        diagnostic,
      )
    ).status,
    404,
  );
  const oversized = await fetch(endpoint, {
    body: JSON.stringify({
      code: "render-error",
      message: "x".repeat(INTERACTIVE_DIAGNOSTIC_BODY_LIMIT),
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  assert.equal(oversized.status, 413);
  assert.equal(live.diagnostics.length, 1);
});

test("Live diagnostics reject non-JSON and unknown view identities", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const endpoint = `${live.liveUrl}/__mokly/interactive/${live.generation}/diagnostics`;
  assert.equal(
    (
      await fetch(endpoint, {
        body: "not json",
        headers: { "content-type": "text/plain" },
        method: "POST",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await post(endpoint, {
        code: "render-error",
        colorScheme: "light",
        entryPath: "missing",
        entryKind: "screen",
        message: "wrong axes",
        viewport: "desktop",
      })
    ).status,
    400,
  );
  assert.equal(live.diagnostics.length, 0);
});

function post(endpoint: string, value: unknown): Promise<Response> {
  return fetch(endpoint, {
    body: JSON.stringify(value),
    headers: { "content-type": "application/json; charset=utf-8" },
    method: "POST",
  });
}

function assertPolicyHeaders(response: Response): void {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}
