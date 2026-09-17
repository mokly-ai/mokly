import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import { pack } from "tar-stream";

import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { UPLOAD_MANIFEST } from "./manifest.js";
import { uploadPath } from "./validation.js";

/** Byte and entry bounds for one archive. */
export interface UploadLimits {
  compressedBytes: number;
  tarBytes: number;
  fileBytes: number;
  files: number;
}

/** Protocol v1 resource ceilings; overrides exist only for focused unit tests. */
export const UPLOAD_LIMITS: Readonly<UploadLimits> = Object.freeze({
  compressedBytes: 100 * 1024 * 1024,
  tarBytes: 512 * 1024 * 1024,
  fileBytes: 64 * 1024 * 1024,
  files: 20_000,
});

/** Encode an already finalized export snapshot without traversing the filesystem. */
export async function bundleUpload(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  signal?: AbortSignal,
  limits: typeof UPLOAD_LIMITS = UPLOAD_LIMITS,
): Promise<Buffer> {
  if (signal?.aborted) throw interrupted();
  if (files.size > limits.files) throw tooLarge();
  const entries = validateEntries(files, limits.fileBytes);
  const archive = pack();
  const chunks: Buffer[] = [];
  let tarBytes = 0;
  let compressedBytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      tarBytes += chunk.length;
      callback(tarBytes > limits.tarBytes ? tooLarge() : null, chunk);
    },
  });
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      compressedBytes += chunk.length;
      if (compressedBytes > limits.compressedBytes) return callback(tooLarge());
      chunks.push(chunk);
      callback();
    },
  });
  const consume = pipeline(archive, limiter, createGzip(), sink, { signal });
  const produce = async () => {
    for (const [name, bytes] of entries) {
      if (signal?.aborted) throw interrupted();
      await new Promise<void>((resolve, reject) => {
        archive.entry(
          {
            name,
            size: bytes.length,
            type: "file",
            mode: 0o644,
            uid: 0,
            gid: 0,
            mtime: new Date(0),
          },
          bytes,
          (error) => (error ? reject(error) : resolve()),
        );
      });
    }
    archive.finalize();
  };
  try {
    await Promise.all([
      consume,
      produce().catch((error: unknown) => {
        archive.destroy(error instanceof Error ? error : interrupted());
        throw error;
      }),
    ]);
    return Buffer.concat(chunks, compressedBytes);
  } catch (error) {
    if (error instanceof MoklyError) throw error;
    throw interrupted();
  }
}

function validateEntries(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  fileLimit: number,
): Map<string, Buffer> {
  const names = new Set<string>();
  const entries = new Map<string, Buffer>();
  for (const [name, content] of files) {
    const folded = name.toLowerCase();
    if (!uploadPath(name) || names.has(folded)) throw invalidPath();
    names.add(folded);
    const size =
      typeof content === "string"
        ? Buffer.byteLength(content)
        : content.byteLength;
    if (size > fileLimit || (name === UPLOAD_MANIFEST && size > 16 * 1024))
      throw tooLarge();
    entries.set(
      name,
      typeof content === "string"
        ? Buffer.from(content)
        : Buffer.from(content.buffer, content.byteOffset, content.byteLength),
    );
  }
  for (const name of names) {
    const parts = name.split("/");
    parts.pop();
    while (parts.length) {
      if (names.has(parts.join("/"))) throw invalidPath();
      parts.pop();
    }
  }
  return entries;
}

function tooLarge(): MoklyError {
  return new MoklyError(
    "upload-too-large",
    "The catalogue exceeds an upload v1 size limit. Reduce the catalogue or its assets.",
  );
}

function invalidPath(): MoklyError {
  return new MoklyError(
    "upload-invalid-bundle",
    "The catalogue contains an unsafe or colliding archive path.",
  );
}

function interrupted(): MoklyError {
  return new MoklyError(
    "upload-failed",
    "Could not package the catalogue or publication was interrupted. Retry the publish command.",
  );
}
