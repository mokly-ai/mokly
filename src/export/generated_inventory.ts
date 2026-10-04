import {
  documentRoute,
  entryRoute,
  generatedViews,
  type HistoricalManifest,
} from "@mokly/viewer/data";

import { isPublicGeneratedRoute } from "../build/styles/routes.js";
import { documentResourceRoute } from "../documents/resource_paths.js";

/** Exact public document/view/resource routes proven by one accepted manifest. */
function manifestGeneratedPaths(
  manifest: HistoricalManifest,
): ReadonlySet<string> {
  return new Set(
    manifest.entries.flatMap((entry) => {
      if (entry.kind === "page") return [entryRoute(entry.path)];
      if (entry.kind !== "document")
        return generatedViews(entry).map((view) => view.path);
      return [
        ...entry.colorSchemes.map((scheme) =>
          documentRoute(entry.path, scheme),
        ),
        ...entry.resources.flatMap((resource) => {
          const route = documentResourceRoute(entry, resource);
          return route ? [route] : [];
        }),
      ];
    }),
  );
}

/** Traversal permissions reach exact files without admitting their siblings. */
export function generatedParentDirectories(
  files: Iterable<string>,
): ReadonlySet<string> {
  const parents = new Set<string>();
  for (const file of files) {
    const segments = file.split("/");
    for (let index = 1; index < segments.length; index++)
      parents.add(segments.slice(0, index).join("/"));
  }
  return parents;
}

/** Include only exact generated CSS/assets captured for the historical side. */
export function historicalGeneratedPaths(
  manifest: HistoricalManifest,
  captured: Iterable<string>,
  prefix: string,
): ReadonlySet<string> {
  const paths = new Set(manifestGeneratedPaths(manifest));
  for (const name of captured) {
    if (!name.startsWith(prefix)) continue;
    const route = name.slice(prefix.length);
    if (isPublicGeneratedRoute(route)) paths.add(route);
  }
  return paths;
}
