import path from "node:path";

import { entryRoute, documentRoute } from "@mokly/viewer/data";

import { generatedViews } from "../../packages/viewer/dist/components/views.js";
import type { ManifestEntry } from "../../packages/viewer/dist/registry/types.js";

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

/** Derive deterministic resource names for synthetic document metadata. */
function documentResourceRoute(
  entry: { path: string; sourcePath: string },
  resource: string,
) {
  const folder = /^(readme|index)\.md$/i.test(
    path.posix.basename(entry.sourcePath),
  )
    ? entry.path
    : path.posix.dirname(entry.path);
  return path.posix.join(
    folder,
    path.posix.relative(path.posix.dirname(entry.sourcePath), resource),
  );
}
