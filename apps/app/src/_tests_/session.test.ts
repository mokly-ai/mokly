import assert from "node:assert/strict";
import { test } from "node:test";

import {
  expectBody,
  expectData,
  mutationHeaders,
  originHeader,
  requestId,
  setCsrfToken,
} from "../api/client";
import { ApiError } from "../api/errors";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("every request carries a fresh correlation identifier", () => {
  const first = requestId();
  assert.match(first, uuid);
  assert.notEqual(first, requestId());
});

test("a mutation carries the session's CSRF token and the app origin", () => {
  setCsrfToken("token-1");
  const headers = mutationHeaders();
  assert.equal(headers["X-CSRF-Token"], "token-1");
  assert.equal(headers.Origin, originHeader().Origin);
  setCsrfToken("token-2");
  assert.equal(mutationHeaders()["X-CSRF-Token"], "token-2");
  setCsrfToken("");
  assert.equal(mutationHeaders()["X-CSRF-Token"], "");
});

test("a refused call becomes the typed failure the screens branch on", async () => {
  const outcome = {
    error: {
      error: {
        code: "unauthenticated",
        reason: "session-expired",
        message: "Sign in again.",
        request_id: "r-1",
      },
    },
    response: new Response(null, { status: 401 }),
  };
  await assert.rejects(
    () => expectData(() => Promise.resolve(outcome)),
    (caught: unknown) => {
      assert.ok(caught instanceof ApiError);
      assert.equal(caught.reason, "session-expired");
      assert.equal(caught.signedOut, true);
      return true;
    },
  );
});

test("a transport failure never escapes as an untyped error", async () => {
  await assert.rejects(
    () => expectData(() => Promise.reject(new TypeError("network"))),
    (caught: unknown) => {
      assert.ok(caught instanceof ApiError);
      assert.equal(caught.reason, "unavailable");
      return true;
    },
  );
});

test("a successful call answers with its body, and an empty one is allowed", async () => {
  const ok = {
    data: { id: "1" },
    response: new Response(null, { status: 200 }),
  };
  assert.deepEqual(await expectData(() => Promise.resolve(ok)), { id: "1" });
  assert.deepEqual(await expectBody(() => Promise.resolve(ok)), { id: "1" });
  const empty = { response: new Response(null, { status: 204 }) };
  assert.equal(await expectData(() => Promise.resolve(empty)), undefined);
  await assert.rejects(() => expectBody(() => Promise.resolve(empty)));
});
