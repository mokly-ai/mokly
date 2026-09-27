import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { uploadMissingBlobs } from "../src/publish/blobs.js";
import { completeUpload } from "../src/publish/complete.js";
import { statusError } from "../src/publish/errors.js";
import { validateUploadManifest } from "../src/publish/manifest.js";
import { requestUploadPlan } from "../src/publish/plan.js";
import {
  MAX_REQUEST_ATTEMPTS,
  MAX_RETRY_AFTER_SECONDS,
  RETRY_BASE_DELAY_MS,
} from "../src/publish/retry.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDES } from "./helpers/guides.js";
import { assertUploadRequest } from "./helpers/upload_request.js";

const read = (...parts: string[]) =>
  readFileSync(path.join(repositoryRoot, ...parts), "utf8");
const protocol = read("docs/protocol/mokly-upload.md").replace(/\s+/gu, " ");
const exchange = read("docs/protocol/mokly-upload-exchange.md").replace(
  /\s+/gu,
  " ",
);
const recovery = read("docs/protocol/mokly-export-recovery.md").replace(
  /\s+/gu,
  " ",
);
const terminal = read("docs/protocol/mokly-terminal-output.md").replace(
  /\s+/gu,
  " ",
);
const verification = read("docs/protocol/ci-verification.md").replace(
  /\s+/gu,
  " ",
);
const release = read("docs/protocol/npm-release.md").replace(/\s+/gu, " ");
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
    exchange,
    /POST to the exact configured endpoint, preserving its path and query string without appending anything/u,
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
  const protocolFences = fenceHeaders(
    read("docs/protocol/mokly-upload-exchange.md"),
  );
  assert.deepEqual(protocolFences, fences);
  const retry = {
    now: () => new Date("2026-09-26T12:00:00.000Z"),
    random: () => 0,
    sleep: async () => undefined,
  };
  const digest = "a".repeat(64);
  const selectedPlan = await requestUploadPlan(
    { endpoint, token: "TOKEN" },
    Buffer.from("archive"),
    new Set([digest]),
    {
      ...retry,
      fetch: async (url, init) => {
        assert.equal(url, endpoint);
        const headers = assertUploadRequest(init, "POST", "TOKEN");
        for (const [key, value] of Object.entries(plan ?? {}).filter(
          ([key]) => key !== "Content-Length",
        ))
          assert.equal(headers.get(key), value);
        return Response.json({
          schemaVersion: 1,
          upload: {
            id: "upload",
            expiresAt: "2026-09-26T13:00:00.000Z",
          },
          missing: [digest],
          blobUrl: "https://example.com/blobs/{sha256}",
          completeUrl: "https://example.com/complete",
        });
      },
    },
  );
  await uploadMissingBlobs(
    selectedPlan,
    new Map([[digest, { sha256: digest, size: 1, bytes: Buffer.from("a") }]]),
    { endpoint, token: "TOKEN" },
    1,
    {
      ...retry,
      fetch: async (_url, init) => {
        const headers = assertUploadRequest(init, "PUT", "TOKEN");
        for (const [key, value] of Object.entries(blob ?? {}).filter(
          ([key]) => key !== "Content-Length",
        ))
          assert.equal(headers.get(key), value);
        return new Response(null, { status: 204 });
      },
    },
  );
  await completeUpload(
    selectedPlan,
    { endpoint, token: "TOKEN" },
    {
      ...retry,
      fetch: async (_url, init) => {
        const headers = assertUploadRequest(init, "POST", "TOKEN");
        for (const [key, value] of Object.entries(complete ?? {}))
          assert.equal(headers.get(key), value);
        return new Response(null, { status: 201 });
      },
    },
  );
  assert.match(prose, /Any `2xx` answer means the file is stored/u);
  assert.match(exchange, /Any 2xx means stored/u);
  assert.match(prose, /`201` means this upload created the publication/u);
  assert.match(exchange, /`201` means this upload created/u);
  assert.match(prose, /none follows a redirect/u);
  assert.match(exchange, /follows no redirect/u);
  const seconds = /times out after (\d+) seconds/u.exec(prose)?.[1];
  assert.ok(seconds);
  assert.ok(exchange.includes(`times out after ${seconds} seconds`));
  const timeout = /AbortSignal\.timeout\(([\d_]+)\)/u.exec(
    read("src/publish/http.ts"),
  )?.[1];
  assert.equal(Number(timeout?.replaceAll("_", "")), Number(seconds) * 1000);
});

test("Complete idempotency, accounting and cancellation copy stay explicit", () => {
  assert.match(
    exchange,
    /Repeating Complete for that upload returns the same status and body and never creates another publication/u,
  );
  assert.match(
    prose,
    /Repeating Complete for that upload returns its first status and body and never publishes again/u,
  );
  assert.match(exchange, /`200` means a different upload already completed/u);
  assert.match(prose, /`200` means a different upload already completed/u);
  for (const source of [exchange, prose]) {
    assert.match(source, /Plan(?:-| )archive/u);
    assert.match(source, /Uploading 0 of 1 file/u);
    assert.match(source, /empty `missing`/u);
    assert.match(source, /Publication was cancelled/u);
  }
  assert.match(exchange, /first publish to an empty receiver.*`0 unchanged`/u);
  assert.match(exchange, /entries sharing one digest each count/u);
  assert.match(exchange, /Blob PUT attempt in any round/u);
  assert.match(exchange, /marker's own byte length participates/u);
  assert.match(
    exchange,
    /The catalogue upload did not complete\. Check the endpoint and connection, then retry/u,
  );
  assert.match(
    exchange,
    /The only signal-based exception is the \[pre-installation window\]\(\.\/mokly-export-recovery\.md#pre-installation-window\)/u,
  );
  assert.match(
    exchange,
    /Outside that window, never infer cancellation from a cause chain, `AggregateError` members, error text or an already-aborted command signal/u,
  );
  assert.match(
    exchange,
    /prints every other error unchanged with that error's own category/u,
  );
  assert.match(
    terminal,
    /exchange cancellation rule.*decides whether a publish failure is a cancellation or another error/u,
  );
  assert.match(
    recovery,
    /restoring the previous export fails, `mokly publish` prints the export rollback error naming the retained backup/u,
  );
  assert.match(
    recovery,
    /lets the event loop complete one full turn that includes an I\/O poll, then checks once more/u,
  );
  assert.match(recovery, /uses no wall-clock delay/u);
  for (const phase of [
    "changed-path evidence",
    "Comparison generation",
    "Changes calculation",
    "removed-page preview",
  ])
    assert.ok(recovery.includes(phase), phase);
  assert.match(
    recovery,
    /keeps the original error object, class, fields, message and stack/u,
  );
  assert.match(recovery, /`MOKLY_DIAGNOSTIC=1`.*stack/u);
  assert.match(
    recovery,
    /hold a referenced Node handle.*esbuild startup.*status 1/u,
  );
  assert.match(
    prose,
    /could not put your previous export back.*recovery error.*folder to recover/u,
  );
});

test("test repository inputs are deterministic and title types stay fixed", () => {
  for (const reference of [
    "origin/",
    "remotes/",
    "refs/remotes",
    "FETCH_HEAD",
    "-r",
    "--all",
    "--remotes",
    "fetch",
    "ls-remote",
    "@{upstream}",
    "branch.<name>.remote",
    "branch.<name>.merge",
  ])
    assert.ok(verification.includes(reference), reference);
  assert.match(verification, /tests\/test_repository_refs\.test\.ts/u);
  assert.match(
    verification,
    /only automated check for this rule.*best-effort static lint/u,
  );
  assert.match(verification, /isolated fixture repository/u);
  assert.match(
    verification,
    /deterministic source edit.*asserts its exact changed destinations and count/u,
  );
  assert.match(
    verification,
    /browser suite's example server runs with `--base HEAD`/u,
  );
  assert.match(
    verification,
    /unit and browser jobs key npm's download cache from the checked-out `package-lock\.json`/u,
  );
  assert.match(
    verification,
    /neither job resolves `origin\/main` or reads a branch-point lockfile/u,
  );
  assert.match(
    verification,
    /Unit and browser tests must depend only on the tree under test and fixture-owned state/u,
  );
  assert.match(
    verification,
    /target comes from the last `-C` or `--git-dir` before that subcommand/u,
  );
  assert.match(
    verification,
    /An options variable or call, or an inline object with a spread, leaves the target unknown and is not reported/u,
  );
  assert.match(verification, /separated and `=` forms follow the same rule/u);
  assert.match(verification, /including shorthand `\{ cwd \}`/u);
  assert.match(verification, /`-r`, `-a`, `--all`, `--remotes`/u);
  assert.match(
    verification,
    /reference-listing flags.*count only for `branch`, `show-branch`, `log`/u,
  );
  assert.match(verification, /argv stored in variables or spreads/u);
  assert.match(verification, /shell command strings/u);
  assert.match(verification, /relative `-C` layered after a real-root `-C`/u);
  assert.match(verification, /`for-each-ref` without a remote pattern/u);
  assert.match(verification, /`git remote`/u);
  assert.match(verification, /`HEAD\.\.FETCH_HEAD`/u);
  assert.match(verification, /modules under `scripts\/`/u);
  assert.match(verification, /product-code defaults/u);
  assert.match(verification, /This type list is fixed/u);
  assert.match(verification, /examples in `AGENTS\.md`/u);
  assert.match(verification, /does not derive policy from Git history/u);
  assert.doesNotMatch(
    verification,
    /lockfile read from the merge-base commit/u,
  );
  assert.match(
    release,
    /CI verification contract.*dependency-cache-and-security.*owns cache inputs/u,
  );
  assert.match(
    release,
    /CI graph and checkout contract.*ci-graph-and-checkout-ownership.*owns verification history/u,
  );
  assert.doesNotMatch(
    release,
    /includes the merge-base lockfile in cache keys/u,
  );
  assert.doesNotMatch(
    release,
    /Full Git history is available where baseline resolution requires/u,
  );
});

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
