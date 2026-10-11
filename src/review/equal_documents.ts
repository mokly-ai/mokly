import {
  generatedResourcePath,
  type HistoricalManifest,
} from "@mokly/viewer/data";

import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import { gitBlobHash } from "../registry/blob_hash.js";

import { assetError } from "./asset_paths.js";
import type { ReviewAssetReader } from "./assets.js";

/** Reuse proven equal accepted document bytes for component-free live result construction. */
export function equalBaseDocuments(
  reader: ReviewAssetReader,
  before: HistoricalManifest,
  outputs: ReadonlyMap<string, GeneratedFile>,
): ReviewAssetReader {
  const equal = new Map<string, Uint8Array>();
  for (const file of before.generatedFiles) {
    if (!/\.html?$/i.test(file.path)) continue;
    const current = outputs.get(file.path);
    if (current === undefined) continue;
    const bytes = generatedBytes(current);
    if (gitBlobHash(bytes, before.blobHashAlgorithm) === file.blobHash)
      equal.set(generatedResourcePath(file.path), bytes);
  }
  const read = (route: string) =>
    equal.has(route) ? Promise.resolve(equal.get(route)!) : reader.read(route);
  return {
    read,
    async readMany(routes) {
      const needed = routes.filter((route) => !equal.has(route));
      const loaded =
        reader.readMany && needed.length
          ? await reader.readMany(needed)
          : undefined;
      if (loaded)
        for (const route of needed)
          if (!loaded.has(route) || loaded.get(route) === undefined)
            throw assetError(route, "batch reader omitted the file");
      return new Map(
        await Promise.all(
          routes.map(
            async (route) =>
              [
                route,
                equal.get(route) ??
                  loaded?.get(route) ??
                  (await reader.read(route)),
              ] as const,
          ),
        ),
      );
    },
    readIfExists: (route) =>
      equal.has(route)
        ? Promise.resolve(equal.get(route))
        : (reader.readIfExists?.(route) ?? reader.read(route)),
    async readManyIfExists(routes) {
      const needed = routes.filter((route) => !equal.has(route));
      const loaded =
        reader.readManyIfExists && needed.length
          ? await reader.readManyIfExists(needed)
          : undefined;
      if (loaded)
        for (const route of needed)
          if (!loaded.has(route))
            throw assetError(route, "batch reader omitted the file");
      return new Map(
        await Promise.all(
          routes.map(
            async (route) =>
              [
                route,
                equal.has(route)
                  ? equal.get(route)
                  : loaded
                    ? loaded.get(route)
                    : await (reader.readIfExists?.(route) ??
                        reader.read(route)),
              ] as const,
          ),
        ),
      );
    },
  };
}
