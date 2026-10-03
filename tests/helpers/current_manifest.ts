import {
  entryRoute,
  generatedViews,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { createManifest } from "../../dist/registry/manifest.js";

/** Add a deterministic synthetic inventory to metadata-only structural fixtures. */
export function currentManifest<
  T extends { entries: readonly ManifestEntry[] },
>(manifest: T) {
  const paths = manifest.entries.flatMap((entry) =>
    entry.kind === "page"
      ? [entryRoute("page", entry.id)]
      : generatedViews(entry).map((view) => view.path),
  );
  return {
    ...manifest,
    assetClosure: [],
    blobHashAlgorithm: "sha1" as const,
    generatedFiles: [...new Set(paths)]
      .sort()
      .map((path) => ({ path, blobHash: "0".repeat(40) })),
    schemaVersion: 8 as const,
  };
}

/** Metadata-only test registries still exercise the real manifest builder. */
export function fixtureManifest(...args: Parameters<typeof createManifest>) {
  return currentManifest(createManifest(...args));
}
