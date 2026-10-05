import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

import { ownedEntries } from "../../dist/export/ownership.js";

export async function archiveNames(
  compressed: Buffer,
): Promise<ReadonlySet<string>> {
  const unpack = extract();
  const names = new Set<string>();
  unpack.on("entry", (header, stream, next) => {
    names.add(header.name);
    stream.on("end", next);
    stream.resume();
  });
  await pipeline(Readable.from([gunzipSync(compressed)]), unpack);
  return names;
}

export async function readArtifact(
  root: string,
): Promise<ReadonlyMap<string, Buffer>> {
  const entries = await ownedEntries(root);
  return new Map(
    await Promise.all(
      entries.files.map(
        async (name) =>
          [name, await fs.readFile(path.join(root, name))] as const,
      ),
    ),
  );
}
