import { MoklyError } from "../errors.js";

import type { ReviewAssetReader } from "./assets.js";

/** Retain one immutable comparison's bytes across pairing, classification and capture. */
export function cachedReviewAssets(
  reader: ReviewAssetReader,
): ReviewAssetReader {
  const cache = new Map<string, Promise<Uint8Array | undefined>>();
  const read = async (route: string): Promise<Uint8Array> => {
    let result = cache.get(route);
    if (!result) {
      result = reader.read(route);
      cache.set(route, result);
    }
    const content = await result;
    if (content === undefined)
      throw new MoklyError(
        "review-invalid",
        `Comparison resource is missing: ${route}`,
      );
    return content;
  };
  const readMany = async (
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array>> => {
    const missing = [...new Set(routes)].filter((route) => !cache.has(route));
    if (missing.length && reader.readMany) {
      const loaded = reader.readMany(missing);
      for (const route of missing)
        cache.set(
          route,
          loaded.then((files) => files.get(route)),
        );
    }
    return new Map(
      await Promise.all(
        routes.map(async (route) => [route, await read(route)] as const),
      ),
    );
  };
  const optional = async (routes: readonly string[]) => {
    const missing = [...new Set(routes)].filter((route) => !cache.has(route));
    if (missing.length && reader.readManyIfExists) {
      const loaded = reader.readManyIfExists(missing);
      for (const route of missing)
        cache.set(
          route,
          loaded.then((files) => files.get(route)),
        );
    } else
      for (const route of missing)
        cache.set(
          route,
          reader.readIfExists ? reader.readIfExists(route) : reader.read(route),
        );
    return new Map(
      await Promise.all(
        routes.map(async (route) => [route, await cache.get(route)!] as const),
      ),
    );
  };
  return {
    read,
    readMany,
    ...(reader.readIfExists || reader.readManyIfExists
      ? {
          readIfExists: async (route: string) =>
            (await optional([route])).get(route),
          readManyIfExists: optional,
        }
      : {}),
  };
}
