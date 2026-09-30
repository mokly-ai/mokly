import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

/** Extract the regular-file entries from a gzip-compressed Plan archive. */
export async function extractArchive(archive) {
  const unpack = extract();
  const files = new Map();
  unpack.on("entry", (header, stream, next) => {
    assert.equal(header.type, "file", header.name);
    assert.equal(files.has(header.name), false, header.name);
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => {
      files.set(header.name, Buffer.concat(chunks));
      next();
    });
    stream.resume();
  });
  await pipeline(Readable.from([gunzipSync(archive)]), unpack);
  return files;
}

/** Assert that one Blob matches its ownership entry. */
export function assertBlob(entry, digest, bytes) {
  assert.equal(validBlob(entry, digest, bytes), true, entry.path);
}

/** Test whether one Blob matches its declared digest and size. */
export function validBlob(entry, digest, bytes) {
  return (
    entry.size === bytes.length &&
    crypto.createHash("sha256").update(bytes).digest("hex") === digest
  );
}

/** Read one incoming receiver request into exact bytes. */
export async function requestBytes(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
