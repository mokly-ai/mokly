import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

import { bundleUpload, UPLOAD_LIMITS } from "../dist/publish/bundle.js";

test("plan archive preserves binary bytes, Unicode and long paths without an enclosing directory", async () => {
  const files = new Map([
    ["mokly-upload.json", Buffer.from('{"schemaVersion":1}\n')],
    ["index.html", Buffer.from("<html>catalogue</html>")],
    [
      `static/${"long-directory/".repeat(20)}café.bin`,
      Buffer.from([0, 255, 13, 10]),
    ],
  ]);
  const compressed = await bundleUpload(files);
  const unpack = extract();
  const received = new Map<string, Buffer>();
  unpack.on("entry", (header, stream, next) => {
    assert.equal(header.type, "file");
    assert.equal(header.mode, 0o644);
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      assert.ok(Buffer.isBuffer(chunk));
      chunks.push(chunk);
    });
    stream.on("end", () => {
      received.set(header.name, Buffer.concat(chunks));
      next();
    });
    stream.resume();
  });
  await pipeline(Readable.from([gunzipSync(compressed)]), unpack);
  assert.deepEqual(received, files);
});

test("bundle limits stop oversized files, file counts, tar bytes and compressed bytes", async () => {
  const files = new Map([["one", Buffer.from("abcdefgh")]]);
  for (const limit of [
    { fileBytes: 7 },
    { files: 0 },
    { tarBytes: 512 },
    { compressedBytes: 10 },
  ])
    await assert.rejects(
      bundleUpload(files, undefined, { ...UPLOAD_LIMITS, ...limit }),
      /upload-too-large/,
    );
  await assert.rejects(
    bundleUpload(new Map([["mokly-upload.json", Buffer.alloc(16 * 1024 + 1)]])),
    /upload-too-large/,
  );
  const tooManyFiles = new Map<string, Buffer>();
  for (let index = 0; index <= UPLOAD_LIMITS.files; index++)
    tooManyFiles.set(`static/${index}.txt`, Buffer.alloc(0));
  await assert.rejects(bundleUpload(tooManyFiles), /upload-too-large/);
});

test("bundle rejects unsafe paths and case-folded file/directory collisions", async () => {
  for (const name of [
    "../escape",
    "/absolute",
    "C:/path",
    "a\\b",
    "a/./b",
    "a\nb",
    "a//b",
    "x".repeat(1025),
  ])
    await assert.rejects(
      bundleUpload(new Map([[name, Buffer.from("a")]])),
      /upload-invalid-bundle/,
    );
  for (const names of [
    ["a", "A"],
    ["dir", "dir/file"],
    ["Dir/file", "dir"],
  ])
    await assert.rejects(
      bundleUpload(new Map(names.map((name) => [name, Buffer.from("a")]))),
      /upload-invalid-bundle/,
    );
});

test("cancelled bundles fail before publishing any bytes", async () => {
  await assert.rejects(
    bundleUpload(new Map([["a", Buffer.from("b")]]), AbortSignal.abort()),
    /upload-failed/,
  );
});
