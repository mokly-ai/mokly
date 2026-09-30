import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

/** Extract regular-file bytes from an in-memory gzip tar in archive order. */
export async function extractUploadArchive(
  archive: Buffer,
): Promise<Map<string, Buffer>> {
  const unpack = extract();
  const files = new Map<string, Buffer>();
  unpack.on("entry", (header, stream, next) => {
    if (header.type !== "file") {
      stream.resume();
      next();
      return;
    }
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: unknown) =>
      chunks.push(Buffer.from(chunk as Uint8Array)),
    );
    stream.on("end", () => {
      files.set(header.name, Buffer.concat(chunks));
      next();
    });
    stream.resume();
  });
  await pipeline(Readable.from([gunzipSync(archive)]), unpack);
  return files;
}
