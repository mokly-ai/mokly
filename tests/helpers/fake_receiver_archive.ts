import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

const COMPRESSED_LIMIT = 100 * 1024 * 1024;
const TAR_LIMIT = 512 * 1024 * 1024;
const FILE_LIMIT = 64 * 1024 * 1024;
const BLOCK = 512;

/** Receiver-side rejection with the response status required by the contract. */
export class FakeReceiverRejection extends Error {
  constructor(readonly status: number) {
    super(`fake receiver rejected upload with ${status}`);
  }
}

/** Extract a bounded gzip tar while accepting regular files only. */
export async function readFakePlanArchive(
  archive: Buffer,
): Promise<Map<string, Buffer>> {
  if (archive.length > COMPRESSED_LIMIT) throw new FakeReceiverRejection(413);
  let tar: Buffer;
  try {
    tar = gunzipSync(archive, { maxOutputLength: TAR_LIMIT + 1 });
  } catch (error) {
    throw new FakeReceiverRejection(
      (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE"
        ? 413
        : 400,
    );
  }
  if (tar.length > TAR_LIMIT) throw new FakeReceiverRejection(413);
  assertTarTermination(tar);
  const unpack = extract();
  const files = new Map<string, Buffer>();
  let rejection: FakeReceiverRejection | undefined;
  unpack.on("entry", (header, stream, next) => {
    const chunks: Buffer[] = [];
    let size = 0;
    if (header.type !== "file" || files.has(header.name))
      rejection ??= new FakeReceiverRejection(400);
    stream.on("data", (chunk: unknown) => {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > FILE_LIMIT) rejection ??= new FakeReceiverRejection(413);
      chunks.push(bytes);
    });
    stream.on("end", () => {
      if (!rejection) files.set(header.name, Buffer.concat(chunks, size));
      next();
    });
    stream.resume();
  });
  try {
    await pipeline(Readable.from([tar]), unpack);
  } catch {
    throw rejection ?? new FakeReceiverRejection(400);
  }
  if (rejection) throw rejection;
  return files;
}

function assertTarTermination(tar: Buffer): void {
  if (tar.length % BLOCK !== 0) throw new FakeReceiverRejection(400);
  for (let offset = 0; offset + BLOCK * 2 <= tar.length; offset += BLOCK) {
    if (!zeroBlock(tar, offset) || !zeroBlock(tar, offset + BLOCK)) continue;
    for (let index = offset + BLOCK * 2; index < tar.length; index++)
      if (tar[index] !== 0) throw new FakeReceiverRejection(400);
    return;
  }
  throw new FakeReceiverRejection(400);
}

function zeroBlock(bytes: Buffer, offset: number): boolean {
  for (let index = offset; index < offset + BLOCK; index++)
    if (bytes[index] !== 0) return false;
  return true;
}
