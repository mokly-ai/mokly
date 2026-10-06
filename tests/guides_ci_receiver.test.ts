import assert from "node:assert/strict";
import test from "node:test";

import { statusError } from "../packages/mokly/src/publish/errors.js";
import { validateUploadManifest } from "../packages/mokly/src/publish/manifest.js";

import {
  read,
  protocol,
  exchange,
  sources,
  upload,
  prose,
  manifest,
} from "./helpers/guides_ci.js";

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

test("CI flags and credential sources exist in code and the upload contract", () => {
  const parser = read("src/cli/arguments.ts");
  const help = read("src/cli/help.ts");
  for (const [id, source] of sources) {
    for (const [, flags] of source.matchAll(
      /\bnpx (?:--no-install )?mokly publish([^\n]*)/gu,
    )) {
      for (const [flag] of (flags ?? "").matchAll(/--[a-z]+(?:-[a-z]+)*/gu)) {
        assert.ok(parser.includes(`"${flag}"`), `${id}: ${flag}`);
        assert.ok(
          help.includes(flag) && protocol.includes(flag),
          `${id}: ${flag}`,
        );
      }
    }
  }
  for (const name of ["MOKLY_ENDPOINT", "MOKLY_TOKEN"]) {
    assert.ok(sources.get("ci/publish-from-ci")?.includes(name));
    assert.ok(protocol.includes(name));
    assert.ok(read("src/publish/options.ts").includes(name));
  }
});
