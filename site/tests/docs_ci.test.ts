import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { uploadCatalogue } from "../../src/publish/http.js";
import { validateUploadManifest } from "../../src/publish/manifest.js";
import { DOCS_PAGES } from "../src/docs/pages.js";
import { repositoryPath } from "../src/workspace.js";

const read = (...parts: string[]) =>
  readFileSync(repositoryPath(...parts), "utf8");
const protocol = read("docs/protocol/mokly-upload.md").replace(/\s+/g, " ");
const sources = new Map(
  DOCS_PAGES.filter((page) => page.section === "ci").map((page) => [
    page.id,
    readFileSync(page.source, "utf8"),
  ]),
);
const upload = sources.get("ci/the-upload")!;
const prose = upload.replace(/\s+/g, " ");
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

test("CI code fences never invent a receiver request path", () => {
  assert.equal(sources.size, 5);
  assert.match(
    protocol,
    /POST to the exact endpoint, without appending a path/,
  );
  assert.match(prose, /exact endpoint/);
  assert.match(prose, /path is never extended/);
  for (const [id, source] of sources) {
    for (const [, fence] of source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
      assert.doesNotMatch(
        fence!,
        /^\s*(?:POST|PUT|GET|PATCH|DELETE)\s+\S+/m,
        id,
      );
    }
  }
});

test("the documented request headers and acceptance match the transport", async () => {
  const endpoint = "https://example.com/receiver?project=team";
  const documented = Object.fromEntries(
    [...upload.matchAll(/^(Authorization|Content-Type|Accept): (.+)$/gm)].map(
      ([, key, value]) => [key!, value!],
    ),
  );
  assert.equal(Object.keys(documented).length, 3);
  for (const [key, value] of Object.entries(documented))
    assert.ok(protocol.includes(`${key}: ${value}`));
  for (const status of [200, 201, 204, 299]) {
    let requests = 0;
    await uploadCatalogue(
      { endpoint, token: "TOKEN" },
      Buffer.from("archive"),
      async (url, init) => {
        requests++;
        assert.equal(url, endpoint);
        assert.equal(init?.method, "POST");
        assert.equal(init?.redirect, "manual");
        for (const [key, value] of Object.entries(documented))
          assert.equal(new Headers(init?.headers).get(key), value);
        return new Response(null, { status });
      },
    );
    assert.equal(requests, 1);
  }
  assert.match(prose, /Any 2xx response means the upload was accepted/);
  assert.match(prose, /no redirect is followed and nothing is retried/);
  assert.match(
    protocol,
    /All 2xx responses mean the complete upload was accepted/,
  );
  const seconds = /times out after (\d+) seconds/.exec(prose)?.[1];
  assert.ok(seconds);
  assert.ok(protocol.includes(`Upload timeout is ${seconds} seconds`));
  const timeout = /AbortSignal.timeout\(([\d_]+)\)/.exec(
    read("src/publish/http.ts"),
  )?.[1];
  assert.equal(Number(timeout?.replaceAll("_", "")), Number(seconds) * 1000);
});

test("comparison fields are required nulls without comparisons, never omitted", () => {
  const rule =
    /Without comparisons, `baseRef`, `baseSha` and `comparisonPath` are all (?:`null`|null)/;
  assert.match(protocol, rule);
  assert.match(prose, rule);
  assert.match(protocol, /missing\/extra upload-manifest fields/);
  assert.match(prose, /reject missing or extra manifest fields/);
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
  assert.match(producer, /baseRef: review\?\.baseRef \?\? null/);
  assert.match(producer, /baseSha: review\?\.baseCommit \?\? null/);
  assert.match(
    producer,
    /comparisonPath = routes.comparisonUrl\?\.slice\(1\) \?\? null/,
  );
});

test("the archive rules accept directories and authenticate before decompression", () => {
  assert.match(
    protocol,
    /Only regular files and optional directories are accepted/,
  );
  assert.match(
    prose,
    /(?:accepts|accept) (?:only )?regular files and optional directories/,
  );
  assert.doesNotMatch(prose, /rejects anything that is not a regular file/);
  for (const entry of [
    "symlinks",
    "hard links",
    "devices",
    "FIFOs",
    "sparse files",
  ])
    assert.ok(prose.includes(entry) && protocol.includes(entry), entry);
  assert.match(prose, /empty private (?:staging )?directory/);
  assert.match(
    protocol,
    /Receivers authenticate before expensive decompression/,
  );
  const receiver =
    upload.split("## What the receiver must do")[1]?.split("\n## ")[0] ?? "";
  const authentication = receiver.search(
    /authenticates? (?:the )?(?:bearer )?credential/,
  );
  const decompression = receiver.search(/decompress/i);
  assert.ok(authentication >= 0, "describe credential authentication");
  assert.ok(
    decompression > authentication,
    "authenticate before describing decompression",
  );
  assert.match(
    receiver.replace(/\s+/g, " "),
    /allowed to publish for the repository/,
  );
});

test("documented rejections agree with the protocol and never retry", async () => {
  const categories = [
    ...upload.matchAll(/^\|[^\n]+\| `(upload-[a-z-]+)`\s*\|/gm),
  ].map(([, category]) => category!);
  const transport = read("src/publish/http.ts");
  const statuses = [...transport.matchAll(/(\d{3}): \[\s*"(upload-[a-z-]+)"/g)];
  assert.equal(statuses.length, 6);
  assert.deepEqual(
    [
      ...new Set(
        statuses.map(([, , category]) => category).concat("upload-failed"),
      ),
    ].sort(),
    categories.sort(),
  );
  for (const status of [
    ...statuses.map(([, value]) => Number(value)),
    302,
    500,
  ]) {
    let requests = 0;
    const category =
      statuses.find(([, value]) => Number(value) === status)?.[2] ??
      "upload-failed";
    assert.ok(protocol.includes(category));
    await assert.rejects(
      uploadCatalogue(
        { endpoint: "https://example.com", token: "TOKEN" },
        Buffer.from("archive"),
        async () => {
          requests++;
          return new Response(null, { status });
        },
      ),
      { code: category },
    );
    assert.equal(requests, 1);
  }
});

test("CI flags and credential sources exist in the CLI and upload contract", () => {
  const parser = read("src/cli/arguments.ts");
  const help = read("src/cli/help.ts");
  for (const [id, source] of sources) {
    for (const [, flags] of source.matchAll(
      /\bnpx (?:--no-install )?mokly publish([^\n]*)/g,
    )) {
      for (const [flag] of flags!.matchAll(/--[a-z]+(?:-[a-z]+)*/g)) {
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
