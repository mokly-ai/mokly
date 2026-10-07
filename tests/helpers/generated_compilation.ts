import type { Compilation } from "../../dist/build/compile.js";
import {
  generatedBytes,
  generatedText,
  type GeneratedFile,
} from "../../dist/build/generated_file.js";
import { gitBlobHash } from "../../dist/registry/blob_hash.js";
import {
  MANIFEST_NAME,
  serializeManifest,
} from "../../dist/registry/manifest.js";

/** Keep intentional synthetic output mutations consistent with the inventory. */
export function withGeneratedOutputs(
  compilation: Compilation,
  files: ReadonlyMap<string, GeneratedFile>,
): Compilation {
  const outputs = new Map(files);
  const manifest = {
    ...compilation.manifest,
    generatedFiles: [...outputs.keys()]
      .filter((file) => file !== MANIFEST_NAME)
      .sort()
      .map((path) => ({
        path,
        blobHash: gitBlobHash(
          generatedBytes(outputs.get(path)!),
          compilation.manifest.blobHashAlgorithm,
        ),
      })),
  };
  outputs.set(MANIFEST_NAME, serializeManifest(manifest));
  return { ...compilation, manifest, outputs };
}

/** Exercise byte-safe writers with a synthetic non-UTF-8 document body. */
export function withBinaryDocument(
  compilation: Compilation,
  route: string,
  bytes: Uint8Array,
): Compilation {
  const outputs = new Map(compilation.outputs);
  const html = generatedText(outputs.get(route), route)!;
  const header = html.slice(0, html.indexOf("\n") + 1);
  outputs.set(route, Buffer.concat([Buffer.from(header), bytes]));
  return withGeneratedOutputs(compilation, outputs);
}
