import assert from "node:assert/strict";
import test from "node:test";

import { statusError } from "../src/publish/errors.js";
import { validateUploadManifest } from "../src/publish/manifest.js";
import {
  MAX_REQUEST_ATTEMPTS,
  MAX_RETRY_AFTER_SECONDS,
  RETRY_BASE_DELAY_MS,
} from "../src/publish/retry.js";

import {
  read,
  exchange,
  upload,
  prose,
  manifest,
} from "./helpers/guides_ci_context.js";

test("documented retries agree with the protocol", () => {
  const attemptWord = numberWord(MAX_REQUEST_ATTEMPTS);
  for (const source of [prose, exchange]) {
    assert.match(source, /408/u);
    for (const status of ["429", "500", "502", "503", "504"])
      assert.ok(source.includes(status), status);
    assert.ok(source.includes(attemptWord));
    assert.match(source, /Retry-After/u);
  }
  const waits = Array.from(
    { length: MAX_REQUEST_ATTEMPTS - 1 },
    (_, index) => (RETRY_BASE_DELAY_MS * 2 ** index) / 1_000,
  );
  assert.deepEqual(waits, [1, 2, 4, 8]);
  const waitWording = `${waits.slice(0, -1).join(", ")} and ${waits.at(-1)} seconds`;
  for (const source of [prose, exchange])
    assert.ok(source.includes(waitWording));
  assert.ok(
    prose.includes(`up to ${numberWord(MAX_RETRY_AFTER_SECONDS)} seconds`),
  );
  assert.ok(
    exchange.includes(`from 0 through ${MAX_RETRY_AFTER_SECONDS} seconds`),
  );
});

function numberWord(value: number): string {
  const words = new Map([
    [5, "five"],
    [60, "sixty"],
  ]);
  const word = words.get(value);
  assert.ok(word, `missing documented number word for ${value}`);
  return word;
}

test("comparison fields stay required nulls without comparisons", () => {
  assert.deepEqual(validateUploadManifest(manifest), manifest);
  for (const field of Object.keys(manifest)) {
    const missing: Record<string, unknown> = { ...manifest };
    delete missing[field];
    assert.throws(() => validateUploadManifest(missing), {
      code: "upload-invalid-bundle",
    });
  }
  assert.throws(() => validateUploadManifest({ ...manifest, extra: true }), {
    code: "upload-invalid-bundle",
  });
  for (const field of ["baseRef", "baseSha"])
    assert.throws(
      () => validateUploadManifest({ ...manifest, [field]: "a".repeat(40) }),
      { code: "upload-invalid-bundle" },
    );
});

test("documented rejections agree with the protocol", () => {
  const categories = [
    ...upload.matchAll(/^\|[^\n]+\| `(upload-[a-z-]+)`\s*\|/gmu),
  ].map(([, category]) => category ?? "");
  const statuses = [
    ...read("src/publish/errors.ts").matchAll(
      /(\d{3}): \[\s*"(upload-[a-z-]+)"/gu,
    ),
  ];
  assert.equal(statuses.length, 6);
  assert.deepEqual(
    [
      ...new Set(
        statuses
          .map(([, , category]) => category ?? "")
          .concat("upload-failed"),
      ),
    ].sort(),
    categories.sort(),
  );
  for (const status of [
    ...statuses.map(([, value]) => Number(value)),
    302,
    500,
  ]) {
    const category =
      statuses.find(([, value]) => Number(value) === status)?.[2] ??
      "upload-failed";
    assert.ok(exchange.includes(category));
    assert.equal(statusError(status).code, category);
  }
});
