import assert from "node:assert/strict";
import test from "node:test";

import {
  readBoundedBody,
  retryableResponse,
  statusError,
} from "../dist/publish/http.js";
import { resolvePublishOptions } from "../dist/publish/options.js";

const options = {
  endpoint: "https://example.com/upload?scope=catalogue",
  token: "private-token",
};

test("publish options prefer explicit credentials and reject unsafe HTTP inputs", () => {
  assert.deepEqual(
    resolvePublishOptions(options, {
      MOKLY_ENDPOINT: "https://other.test",
      MOKLY_TOKEN: "other",
    }),
    options,
  );
  assert.deepEqual(
    resolvePublishOptions(
      {},
      { MOKLY_ENDPOINT: options.endpoint, MOKLY_TOKEN: options.token },
    ),
    options,
  );
  for (const endpoint of [
    "",
    "./upload",
    "ftp://example.com",
    "https://user:secret@example.com",
    "https://example.com/#secret",
  ])
    assert.throws(
      () => resolvePublishOptions({ ...options, endpoint }, {}),
      /cli-invalid/,
    );
  for (const token of ["", "a\nb", "a b", "a:b"])
    assert.throws(
      () => resolvePublishOptions({ ...options, token }, {}),
      /cli-invalid/,
    );
});

test("HTTP statuses have stable categories without response diagnostics", () => {
  for (const [status, code] of [
    [400, "upload-invalid-bundle"],
    [422, "upload-invalid-bundle"],
    [401, "upload-unauthorized"],
    [403, "upload-unauthorized"],
    [413, "upload-too-large"],
    [426, "upload-unsupported-version"],
    [302, "upload-failed"],
    [404, "upload-failed"],
  ] as const) {
    const error = statusError(status);
    assert.equal(error.code, code);
    assert.doesNotMatch(String(error), /private-token/);
    assert.equal(error.cause, undefined);
  }
});

test("retryable statuses accept only bounded integer Retry-After", () => {
  for (const [value, expected] of [
    ["0", 0],
    ["60", 60_000],
    ["61", undefined],
    ["1.5", undefined],
    ["date", undefined],
  ] as const) {
    const retry = retryableResponse(
      new Response(null, { status: 503, headers: { "Retry-After": value } }),
    );
    assert.equal(retry?.retryAfterMs, expected, value);
  }
  assert.equal(
    retryableResponse(new Response(null, { status: 404 })),
    undefined,
  );
});

test("bounded response reads reject declared and streamed excess", async () => {
  assert.equal(
    await readBoundedBody(
      new Response("1234", { headers: { "Content-Length": "4" } }),
      3,
    ),
    undefined,
  );
  assert.equal(await readBoundedBody(new Response("1234"), 3), undefined);
  assert.deepEqual(
    await readBoundedBody(new Response("1234"), 4),
    Buffer.from("1234"),
  );
});
