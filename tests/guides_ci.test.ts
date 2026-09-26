import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { uploadCatalogue } from "../src/publish/http.js";
import { validateUploadManifest } from "../src/publish/manifest.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDES } from "./helpers/guides.js";

const read = (...parts: string[]) =>
  readFileSync(path.join(repositoryRoot, ...parts), "utf8");
const protocol = read("docs/protocol/mokly-upload.md").replace(/\s+/gu, " ");
const sources = new Map(
  GUIDES.filter((page) => page.frontmatter.section === "ci").map((page) => [
    page.id,
    page.source,
  ]),
);
const upload = sources.get("ci/the-upload") ?? "";
const prose = upload.replace(/\s+/gu, " ");
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
    /POST to the exact endpoint, without appending a path/u,
  );
  assert.match(prose, /exact endpoint/u);
  assert.match(prose, /path is never extended/u);
  for (const [id, source] of sources) {
    for (const [, fence] of source.matchAll(/```[^\n]*\n([\s\S]*?)```/gu))
      assert.doesNotMatch(
        fence ?? "",
        /^\s*(?:POST|PUT|GET|PATCH|DELETE)\s+\S+/mu,
        id,
      );
  }
});

function fenceHeaders(source: string): Array<Record<string, string>> {
  return [...source.matchAll(/```http\n([\s\S]*?)```/gu)].map(([, body]) =>
    Object.fromEntries(
      [...(body ?? "").matchAll(/^([A-Za-z-]+): (.+)$/gmu)].map(
        ([, key, value]) => [key ?? "", value ?? ""],
      ),
    ),
  );
}

test("documented request headers and acceptance match the transport", async () => {
  const endpoint = "https://example.com/receiver?project=team";
  const fences = fenceHeaders(upload);
  assert.equal(fences.length, 3);
  const [plan, blob, complete] = fences;
  assert.deepEqual(plan, {
    Authorization: "Bearer TOKEN",
    "Content-Type": "application/gzip",
    Accept: "application/json",
    "Content-Length": "<bytes>",
  });
  assert.deepEqual(blob, {
    Authorization: "Bearer TOKEN",
    "Content-Type": "application/octet-stream",
    "Content-Length": "<size from the marker>",
  });
  assert.deepEqual(complete, {
    Authorization: "Bearer TOKEN",
    Accept: "application/json",
    "Content-Length": "0",
  });
  const protocolFences = fenceHeaders(read("docs/protocol/mokly-upload.md"));
  assert.deepEqual(protocolFences, fences);
  const fixed = Object.entries(plan ?? {}).filter(
    ([key]) => key !== "Content-Length",
  );
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
        for (const [key, value] of fixed)
          assert.equal(new Headers(init?.headers).get(key), value);
        return new Response(null, { status });
      },
    );
    assert.equal(requests, 1);
  }
  assert.match(prose, /Any `2xx` answer means the file is stored/u);
  assert.match(protocol, /Any 2xx means stored/u);
  assert.match(prose, /`201` means a new publication is live/u);
  assert.match(protocol, /`201` means a new publication is live/u);
  assert.match(prose, /none follows a redirect/u);
  assert.match(protocol, /follows no redirect/u);
  const seconds = /times out after (\d+) seconds/u.exec(prose)?.[1];
  assert.ok(seconds);
  assert.ok(protocol.includes(`times out after ${seconds} seconds`));
  const timeout = /AbortSignal\.timeout\(([\d_]+)\)/u.exec(
    read("src/publish/http.ts"),
  )?.[1];
  assert.equal(Number(timeout?.replaceAll("_", "")), Number(seconds) * 1000);
});

test("documented retries agree with the protocol", () => {
  for (const source of [prose, protocol]) {
    assert.match(source, /408/u);
    for (const status of ["429", "500", "502", "503", "504"])
      assert.ok(source.includes(status), status);
    assert.match(source, /five/u);
    assert.match(source, /Retry-After/u);
    assert.match(source, /expir/u);
  }
  assert.match(prose, /at most sixteen seconds/u);
  assert.match(protocol, /min\(16 s, 1 s × 2\^\(k−2\)\)/u);
  assert.match(prose, /up to sixty seconds/u);
  assert.match(protocol, /from 0 to 60 seconds/u);
  assert.match(prose, /plans once more/u);
  assert.match(protocol, /run Plan once more/u);
  assert.match(prose, /second `409` or `410` fails/u);
  assert.match(protocol, /second `409` or\s+`410` is `upload-failed`/u);
  assert.match(prose, /already published for this commit/u);
  assert.match(protocol, /already published for this commit/u);
  assert.match(prose, /Any other `2xx` fails/u);
  assert.match(protocol, /Any other 2xx is `upload-failed`/u);
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
  assert.match(protocol, /Accept only regular files/u);
  assert.match(prose, /accept only regular files/u);
  for (const entry of [
    "symlinks",
    "hard links",
    "devices",
    "FIFOs",
    "sparse files",
  ])
    assert.ok(prose.includes(entry) && protocol.includes(entry), entry);
  assert.match(prose, /empty private (?:staging )?directory/u);
  assert.match(protocol, /authenticate before decompression/u);
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

test("documented rejections agree with the protocol", async () => {
  const categories = [
    ...upload.matchAll(/^\|[^\n]+\| `(upload-[a-z-]+)`\s*\|/gmu),
  ].map(([, category]) => category ?? "");
  const statuses = [
    ...read("src/publish/http.ts").matchAll(
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
