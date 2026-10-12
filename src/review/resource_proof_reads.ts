/** Required-only proof probes retain successful bytes, never rejected promises. */
import type { ReviewAssetReader } from "./assets.js";

export async function prefetchProofReads(
  reader: ReviewAssetReader,
  files: Map<string, Promise<Uint8Array>>,
  routes: readonly string[],
): Promise<boolean> {
  const missing = routes.filter((route) => !files.has(route));
  if (!missing.length) return true;
  if (reader.readMany) {
    try {
      const loaded = await reader.readMany(missing);
      for (const route of missing) {
        const content = loaded.get(route);
        if (content !== undefined) files.set(route, Promise.resolve(content));
      }
      return missing.every((route) => loaded.get(route) !== undefined);
    } catch {
      return false;
    }
  }
  const available = await Promise.all(
    missing.map(async (route) => {
      try {
        const content = await reader.read(route);
        files.set(route, Promise.resolve(content));
        return true;
      } catch {
        return false;
      }
    }),
  );
  return available.every(Boolean);
}
