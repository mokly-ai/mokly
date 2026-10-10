import { MoklyError } from "../errors.js";

import type { ReviewAssetReader } from "./assets.js";

/** Retain one immutable comparison's bytes across pairing, classification and capture. */
export function cachedReviewAssets(
  reader: ReviewAssetReader,
): ReviewAssetReader {
  const required = new Map<string, Promise<Uint8Array>>();
  const probes = new Map<string, Promise<Uint8Array | undefined>>();
  const read = (route: string): Promise<Uint8Array> => {
    let result = required.get(route);
    if (!result) {
      const probe = probes.get(route);
      result = retain(
        required,
        route,
        (async () => {
          const content = await probe?.catch(() => undefined);
          return requiredBytes(route, content ?? (await reader.read(route)));
        })(),
      );
    }
    return result;
  };
  const readMany = async (
    routes: readonly string[],
  ): Promise<ReadonlyMap<string, Uint8Array>> => {
    const unique = [...new Set(routes)];
    await Promise.all(
      unique.map(async (route) => {
        if (required.has(route)) return;
        const content = await probes.get(route)?.catch(() => undefined);
        if (content !== undefined && !required.has(route))
          retain(required, route, Promise.resolve(content));
      }),
    );
    const missing = unique.filter((route) => !required.has(route));
    if (missing.length && reader.readMany) {
      const loaded = reader.readMany(missing);
      for (const route of missing)
        retain(
          required,
          route,
          loaded.then((files) => requiredBytes(route, files.get(route))),
        );
    }
    return new Map(
      await Promise.all(
        routes.map(async (route) => [route, await read(route)] as const),
      ),
    );
  };
  const optional = async (routes: readonly string[]) => {
    const missing = [...new Set(routes)].filter(
      (route) => !required.has(route) && !probes.has(route),
    );
    if (missing.length && reader.readManyIfExists) {
      const loaded = reader.readManyIfExists(missing);
      for (const route of missing)
        retain(
          probes,
          route,
          loaded.then((files) => files.get(route)),
        );
    } else
      for (const route of missing)
        retain(
          probes,
          route,
          reader.readIfExists ? reader.readIfExists(route) : reader.read(route),
        );
    return new Map(
      await Promise.all(
        routes.map(
          async (route) =>
            [route, await (required.get(route) ?? probes.get(route))!] as const,
        ),
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

/** A rejected probe or batch never replaces a later required read's own failure. */
function retain<T>(
  cache: Map<string, Promise<T>>,
  route: string,
  result: Promise<T>,
): Promise<T> {
  cache.set(route, result);
  void result.catch(() => {
    if (cache.get(route) === result) cache.delete(route);
  });
  return result;
}

function requiredBytes(
  route: string,
  content: Uint8Array | undefined,
): Uint8Array {
  if (content === undefined)
    throw new MoklyError(
      "review-invalid",
      `Comparison resource is missing: ${route}`,
    );
  return content;
}
