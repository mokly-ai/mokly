import {
  entryRoute,
  documentRoute,
  generatedViews,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { documentResourceRoute } from "../../dist/documents/resource_paths.js";
import { createManifest } from "../../dist/registry/manifest.js";

/** Add a deterministic synthetic inventory to metadata-only structural fixtures. */
export function currentManifest<
  T extends { entries: readonly ManifestEntry[] },
>(manifest: T) {
  const paths = manifest.entries.flatMap((entry) =>
    entry.kind === "page"
      ? [entryRoute(entry.path)]
      : entry.kind === "document"
        ? entry.colorSchemes.map((scheme) => documentRoute(entry.path, scheme))
        : generatedViews(entry).map((view) => view.path),
  );
  const resources = manifest.entries.flatMap((entry) =>
    entry.kind === "document"
      ? entry.resources.flatMap(
          (resource) => documentResourceRoute(entry, resource) ?? [],
        )
      : [],
  );
  return {
    folders: [],
    ...manifest,
    assetClosure: [],
    blobHashAlgorithm: "sha1" as const,
    generatedFiles: [...new Set([...paths, ...resources])]
      .sort()
      .map((path) => ({ path, blobHash: "0".repeat(40) })),
    schemaVersion: 10 as const,
  };
}

/** Metadata-only test registries still exercise the real manifest builder. */
export function fixtureManifest(...args: Parameters<typeof createManifest>) {
  return currentManifest(createManifest(...args));
}
