import assert from "node:assert/strict";
import { test } from "node:test";

import { ineligibleCauses } from "../api/error-data";
import { decodeApiError, transportError } from "../api/errors";
import { apiReasons, isApiReason } from "../api/reasons";

function response(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers });
}

test("the envelope decodes into the values the UI branches on", () => {
  const error = decodeApiError(
    {
      error: {
        code: "failed-precondition",
        reason: "version-conflict",
        message: "Refresh to see the latest changes.",
        request_id: "01994f10-0000-7000-8000-000000000001",
        data: { currentVersion: 2 },
      },
    },
    response(400),
    "fallback",
  );
  assert.equal(error.code, "failed-precondition");
  assert.equal(error.reason, "version-conflict");
  assert.equal(error.requestId, "01994f10-0000-7000-8000-000000000001");
  assert.equal(error.dataFor("version-conflict")?.currentVersion, 2);
  assert.equal(error.signedOut, false);
});

test("an authentication refusal reports itself as signed out", () => {
  for (const reason of ["unauthenticated", "session-expired"]) {
    const error = decodeApiError(
      {
        error: {
          code: "unauthenticated",
          reason,
          message: "x",
          request_id: "r",
        },
      },
      response(401),
      "fallback",
    );
    assert.equal(error.signedOut, true);
  }
});

test("a rate limit carries the server's own retry delay", () => {
  const error = decodeApiError(
    {
      error: {
        code: "resource-exhausted",
        reason: "rate-limited",
        message: "x",
        request_id: "r",
      },
    },
    response(429, { "retry-after": "42" }),
    "fallback",
  );
  assert.equal(error.retryAfterSeconds, 42);
});

test("a body that is not the envelope still produces a correlated failure", () => {
  const error = decodeApiError(
    "<html>gateway</html>",
    response(502, { "x-request-id": "edge-1" }),
    "fallback",
  );
  assert.equal(error.reason, "internal-error");
  assert.equal(error.requestId, "edge-1");
  assert.equal(error.status, 502);
});

test("a reason this build does not know is preserved but not matched", () => {
  const error = decodeApiError(
    {
      error: {
        code: "internal",
        reason: "brand-new",
        message: "x",
        request_id: "r",
      },
    },
    response(500),
    "fallback",
  );
  assert.equal(error.reason, "unrecognized");
  assert.equal(error.rawReason, "brand-new");
  assert.equal(error.signedOut, false);
});

test("a request that never reached the API is still typed and correlated", () => {
  const error = transportError("local-1");
  assert.equal(error.reason, "unavailable");
  assert.equal(error.status, 0);
  assert.equal(error.requestId, "local-1");
});

test("every catalogued reason is recognized and the set is unique", () => {
  assert.equal(new Set(apiReasons).size, apiReasons.length);
  for (const reason of apiReasons) assert.equal(isApiReason(reason), true);
  assert.equal(isApiReason("not-a-reason"), false);
});

test("a pull request that cannot build carries the cause it names", () => {
  const refused = (cause: unknown) =>
    decodeApiError(
      {
        error: {
          code: "failed-precondition",
          reason: "build-ineligible",
          message: "The API's own sentence.",
          request_id: "r",
          data: { cause },
        },
      },
      response(400),
      "fallback",
    );
  for (const cause of ineligibleCauses)
    assert.equal(refused(cause).dataFor("build-ineligible")?.cause, cause);
  // A cause this build does not know is dropped rather than assumed, so no
  // screen answers it with a sentence chosen for another cause.
  for (const cause of ["draft-pull-request", 4, undefined])
    assert.equal(refused(cause).dataFor("build-ineligible"), undefined);
});

test("a failure reads only the data its own reason carries", () => {
  const error = decodeApiError(
    {
      error: {
        code: "already-exists",
        reason: "build-already-active",
        message: "x",
        request_id: "r",
        data: { buildId: "b-active", cause: "unknown" },
      },
    },
    response(409),
    "fallback",
  );
  assert.deepEqual(error.dataFor("build-already-active"), {
    buildId: "b-active",
  });
  assert.equal(error.dataFor("build-ineligible"), undefined);
});
