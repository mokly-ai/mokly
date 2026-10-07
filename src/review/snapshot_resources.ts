import {
  snapshotResourcePath,
  type ReviewArtifactContent,
} from "@mokly/viewer/data";

import { timeAsync } from "../diagnostics/timings.js";

import { addArtifactFile } from "./artifact_files.js";
import { assetError } from "./asset_paths.js";
import { referencedRoutes } from "./asset_references.js";

/** Copy a pane and every transitively referenced local CSS/static dependency. */
export async function copySnapshotDependencies(
  files: Map<string, ReviewArtifactContent>,
  side: "after" | "before",
  seedRoutes: ReadonlySet<string>,
  read: (route: string) => Promise<ReviewArtifactContent>,
  readMany?: (
    routes: readonly string[],
  ) => Promise<ReadonlyMap<string, ReviewArtifactContent>>,
): Promise<void> {
  return timeAsync("review.resource-graph", async () => {
    let queued = [...seedRoutes].sort();
    const seen = new Set<string>();
    while (queued.length > 0) {
      const batch = queued.filter((route) => !seen.has(route));
      for (const route of batch) seen.add(route);
      const missing = batch.filter(
        (route) => files.get(snapshotResourcePath(side, route)) === undefined,
      );
      if (missing.length > 0) {
        const loaded = readMany
          ? await readMany(missing)
          : await readIndividually(missing, read);
        for (const route of missing) {
          const content = loaded.get(route);
          if (content === undefined) {
            throw assetError(route, "batch reader omitted the file");
          }
          addArtifactFile(files, snapshotResourcePath(side, route), content);
        }
      }
      const discovered = new Set<string>();
      for (const route of batch) {
        const content = files.get(snapshotResourcePath(side, route));
        if (content === undefined) {
          throw assetError(route, "snapshot dependency is unavailable");
        }
        for (const dependency of referencedRoutes(route, content)) {
          if (!seen.has(dependency)) discovered.add(dependency);
        }
      }
      queued = [...discovered].sort();
    }
  });
}

async function readIndividually(
  routes: readonly string[],
  read: (route: string) => Promise<ReviewArtifactContent>,
): Promise<ReadonlyMap<string, ReviewArtifactContent>> {
  const files = new Map<string, ReviewArtifactContent>();
  for (const route of routes) files.set(route, await read(route));
  return files;
}
