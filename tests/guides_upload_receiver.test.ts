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
  exchange,
  prose,
  protocol,
  read,
  upload,
} from "./helpers/guides_ci.js";

const manifest = {
  schemaVersion: 1,
  moklyVersion: "1.0.0",
  repository: { host: "example.com", owner: "team", name: "project" },
  branch: "main",
  headSha: "a".repeat(40),
  baseRef: null,
  baseSha: null,
  pullRequest: null,
  configPath: "mokly.config.ts",
  exportedAt: "2026-09-16T00:00:00.000Z",
  comparisonPath: null,
};

function numberWord(value: number): string {
  const words = new Map([
    [5, "five"],
    [60, "sixty"],
  ]);
  const word = words.get(value);
  assert.ok(word, `missing documented number word for ${value}`);
  return word;
}

test("receiver limits, stored blobs and plan URL protocols are unambiguous", () => {
  for (const source of [exchange, prose]) {
    assert.match(source, /unfinished/u);
    assert.match(source, /1,024 UTF-8 bytes/u);
    assert.match(source, /`413`|413/u);
    assert.match(source, /`400` or `422`|400\/422/u);
  }
  assert.match(exchange, /absolute `http:` or\s+`https:` URLs/u);
  assert.match(exchange, /`blob:`, `data:`, `file:`/u);
  assert.match(prose, /`blob:` and other\s+schemes are refused/u);
});

test("documented retries agree with the protocol", () => {
  const attemptWord = numberWord(MAX_REQUEST_ATTEMPTS);
  for (const source of [prose, exchange]) {
    assert.match(source, /408/u);
    for (const status of ["429", "500", "502", "503", "504"])
      assert.ok(source.includes(status), status);
    assert.ok(source.includes(attemptWord));
    assert.match(source, /Retry-After/u);
    assert.match(source, /expir/u);
  }
  const retrySource = read("src/publish/retry.ts");
  const waits = Array.from(
    { length: MAX_REQUEST_ATTEMPTS - 1 },
    (_, index) => (RETRY_BASE_DELAY_MS * 2 ** index) / 1_000,
  );
  assert.deepEqual(waits, [1, 2, 4, 8]);
  const waitWording = `${waits.slice(0, -1).join(", ")} and ${waits.at(-1)} seconds`;
  for (const source of [prose, exchange])
    assert.ok(source.includes(waitWording));
  assert.doesNotMatch(retrySource, /16_?000|Math\.min/u);
  assert.doesNotMatch(prose, /sixteen seconds/u);
  assert.doesNotMatch(exchange, /16 s/u);
  assert.ok(
    prose.includes(`up to ${numberWord(MAX_RETRY_AFTER_SECONDS)} seconds`),
  );
  assert.ok(
    exchange.includes(`from 0 through ${MAX_RETRY_AFTER_SECONDS} seconds`),
  );
  assert.match(prose, /plans once more/u);
  assert.match(exchange, /one fresh Plan/u);
  assert.match(prose, /second `409` or `410` fails/u);
  assert.match(
    exchange,
    /A second `409`,\s+`410`, or local expiry is `upload-failed`/u,
  );
  assert.match(prose, /already published for this commit/u);
  assert.match(exchange, /already published for this commit/u);
  assert.match(prose, /Any other `2xx` fails/u);
  assert.match(exchange, /Any other 2xx is `upload-failed`/u);
});

test("comparison fields stay required nulls without comparisons", () => {
  const rule =
    /Without comparisons, `baseRef`, `baseSha` and `comparisonPath` are all (?:`null`|null)/u;
  assert.match(protocol, rule);
  assert.match(prose, rule);
  assert.match(protocol, /missing\/extra upload-manifest fields/u);
  assert.match(prose, /reject missing or extra manifest fields/u);
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
  const producer = read("src/publish/run.ts");
  assert.match(producer, /baseRef: review\?\.baseRef \?\? null/u);
  assert.match(producer, /baseSha: review\?\.baseCommit \?\? null/u);
  assert.match(
    producer,
    /comparisonPath = routes\.comparisonUrl\?\.slice\(1\) \?\? null/u,
  );
});

test("archive rules accept only regular files and authenticate before decompression", () => {
  assert.match(exchange, /contains only regular root-relative files/u);
  assert.match(prose, /accept only regular files/u);
  for (const entry of [
    "symlinks",
    "hard links",
    "devices",
    "FIFOs",
    "sparse files",
  ])
    assert.ok(prose.includes(entry) && exchange.includes(entry), entry);
  assert.match(prose, /empty private (?:staging )?directory/u);
  assert.match(exchange, /Authenticate before decompression/u);
  const receiver =
    upload.split("## What the receiver must do")[1]?.split("\n## ")[0] ?? "";
  const authentication = receiver.search(
    /authenticates? (?:the )?(?:bearer )?credential/u,
  );
  const decompression = receiver.search(/decompress/iu);
  assert.ok(authentication >= 0);
  assert.ok(decompression > authentication);
  assert.match(
    receiver.replace(/\s+/gu, " "),
    /allowed to publish for the repository/u,
  );
  assert.match(receiver, /digest/u);
  assert.match(receiver, /`409`/u);
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
