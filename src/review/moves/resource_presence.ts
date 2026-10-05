import type { ReviewAssetReader } from "../assets.js";

/** Preserve same-route evidence when an alias destination already exists in the baseline. */
export async function historicalResourceRoutes(
  routes: readonly string[],
  reader: ReviewAssetReader,
): Promise<ReadonlySet<string>> {
  if (!routes.length) return new Set();
  if (!reader.readManyIfExists && !reader.readIfExists) return new Set(routes);
  const files = reader.readManyIfExists
    ? await reader.readManyIfExists(routes)
    : new Map(
        await Promise.all(
          routes.map(
            async (route) =>
              [route, await reader.readIfExists!(route)] as const,
          ),
        ),
      );
  return new Set(routes.filter((route) => files.get(route) !== undefined));
}
