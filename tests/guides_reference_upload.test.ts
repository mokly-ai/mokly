import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { bundleUpload, UPLOAD_LIMITS } from "../src/publish/bundle.js";
import { uploadCatalogue } from "../src/publish/http.js";
import { UPLOAD_MANIFEST } from "../src/publish/manifest.js";
import { resolvePublishOptions } from "../src/publish/options.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { codeCell, GUIDES, guideSection, tableRows } from "./helpers/guides.js";

const receiver =
  GUIDES.find((guide) => guide.id === "reference/upload-receiver")?.body ?? "";
const flat = (text: string) => text.replace(/\s+/gu, " ");
const endpoint = "https://receiver.example.com/uploads?team=web";
const archive = Buffer.from("archive");
function bytes(value: string | undefined): number {
  const match = /^([\d,]+) (MiB|KiB|bytes)$/u.exec(value ?? "");
  if (!match) return Number((value ?? "").replaceAll(",", ""));
  const units = { MiB: 1024 * 1024, KiB: 1024, bytes: 1 } as const;
  return Number(match[1]?.replaceAll(",", "")) * units[match[2] as "MiB"];
}

test("the documented request matches what publish sends", async () => {
  const request = guideSection(receiver, "The request");
  const fence = /```http\n([\s\S]*?)```/u.exec(request)?.[1] ?? "";
  const documented = new Map(
    fence
      .trim()
      .split("\n")
      .map((line) => line.split(": ") as [string, string]),
  );
  let requests = 0;
  await uploadCatalogue(
    { endpoint, token: "TOKEN" },
    archive,
    async (url, init) => {
      requests++;
      assert.equal(url, endpoint);
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "manual");
      const headers = new Headers(init?.headers);
      assert.deepEqual(
        [...headers.keys()].sort(),
        [...documented.keys()].map((name) => name.toLowerCase()).sort(),
      );
      for (const name of ["Authorization", "Content-Type", "Accept"])
        assert.equal(headers.get(name), documented.get(name), name);
      assert.equal(headers.get("Content-Length"), String(archive.length));
      return new Response(null, { status: 204 });
    },
  );
  assert.equal(requests, 1);
  const seconds = /gives up after (\d+) seconds/u.exec(flat(request))?.[1];
  const timeout = /AbortSignal\.timeout\(([\d_]+)\)/u.exec(
    readFileSync(path.join(repositoryRoot, "src/publish/http.ts"), "utf8"),
  )?.[1];
  assert.equal(Number(timeout?.replaceAll("_", "")), Number(seconds) * 1000);
});

test("the documented token grammar is the one publish enforces", () => {
  const grammar = /Issue tokens that match `([^`]+)`/u.exec(receiver)?.[1];
  assert.ok(grammar);
  const pattern = new RegExp(`^${grammar}$`, "u");
  for (const token of [
    "TOKEN",
    "a.b_c~d+e/f-g==",
    "-TOKEN",
    "a=b",
    "a b",
    "tök",
    "a@b",
  ]) {
    let accepted = true;
    try {
      resolvePublishOptions({ endpoint, token }, {});
    } catch {
      accepted = false;
    }
    assert.equal(accepted, pattern.test(token), token);
  }
});

test("every documented status reaches publish as its category", async () => {
  const responses = guideSection(receiver, "Responses");
  const rows = tableRows(responses);
  const documented = new Map<number, string>();
  for (const [status, , category] of rows)
    for (const [, code] of (status ?? "").matchAll(/`(\d{3})`/gu))
      documented.set(Number(code), codeCell(category));
  const implemented = [
    ...readFileSync(
      path.join(repositoryRoot, "src/publish/http.ts"),
      "utf8",
    ).matchAll(/(\d{3}): \[\s*"(upload-[a-z-]+)"/gu),
  ].map(([, status, category]) => [Number(status), category ?? ""] as const);
  assert.deepEqual(
    [...documented].sort(([left], [right]) => left - right),
    [...implemented].sort(([left], [right]) => left - right),
  );
  const other = rows.find(([status]) => status === "Any other status");
  assert.equal(codeCell(other?.[2]), "upload-failed");
  for (const [status, category] of [
    ...documented,
    [302, "upload-failed"],
    [404, "upload-failed"],
    [500, "upload-failed"],
  ] as const)
    await assert.rejects(
      uploadCatalogue({ endpoint, token: "TOKEN" }, archive, async () => {
        return new Response(null, { status });
      }),
      { code: category },
    );
  await assert.rejects(
    uploadCatalogue({ endpoint, token: "TOKEN" }, archive, async () => {
      throw new TypeError("network");
    }),
    { code: "upload-failed" },
  );
  for (const status of [200, 201, 204, 299])
    await uploadCatalogue(
      { endpoint, token: "TOKEN" },
      archive,
      async () => new Response(null, { status }),
    );
  assert.match(flat(responses), /Any `2xx` status accepts the upload/u);
  assert.match(flat(responses), /A timeout or network failure is also/u);
});

test("the documented limits are the limits publish enforces", async () => {
  const limits = new Map(
    tableRows(guideSection(receiver, "Limits")).map(([label, value]) => [
      label ?? "",
      value,
    ]),
  );
  assert.equal(limits.size, 6);
  assert.equal(
    bytes(limits.get("Compressed request body")),
    UPLOAD_LIMITS.compressedBytes,
  );
  assert.equal(
    bytes(limits.get("Uncompressed tar stream, including headers and padding")),
    UPLOAD_LIMITS.tarBytes,
  );
  assert.equal(bytes(limits.get("One file")), UPLOAD_LIMITS.fileBytes);
  assert.equal(
    bytes(limits.get("Files, including the manifest and ownership marker")),
    UPLOAD_LIMITS.files,
  );
  const manifest = bytes(limits.get("Upload manifest"));
  await bundleUpload(new Map([[UPLOAD_MANIFEST, "m".repeat(manifest)]]));
  await assert.rejects(
    bundleUpload(new Map([[UPLOAD_MANIFEST, "m".repeat(manifest + 1)]])),
    { code: "upload-too-large" },
  );
  const pathBytes = bytes(limits.get("Path"));
  assert.equal(pathBytes, UPLOAD_LIMITS.pathBytes);
  await bundleUpload(new Map([["p".repeat(pathBytes), "file"]]));
  await assert.rejects(
    bundleUpload(new Map([["p".repeat(pathBytes + 1), "file"]])),
    { code: "upload-too-large" },
  );
});
