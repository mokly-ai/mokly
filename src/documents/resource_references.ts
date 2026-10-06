import { documentRoute, type ManifestEntry } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import { extractHtmlReferences } from "../html_references.js";
import { resolveResourceReference } from "../review/asset_references.js";

import { documentResourceRoute } from "./resource_paths.js";

/** Declared public resources keyed by each document's generated scheme route. */
export type DocumentResourceIndex = ReadonlyMap<string, ReadonlySet<string>>;

/** Index only validated document resources; source files never become capture paths. */
export function documentResourceIndex(
  entries: readonly ManifestEntry[],
): DocumentResourceIndex {
  const index = new Map<string, ReadonlySet<string>>();
  for (const entry of entries) {
    if (entry.kind !== "document") continue;
    const resources = new Set(
      entry.resources.map((resource) => {
        const route = documentResourceRoute(entry, resource);
        if (!route)
          throw new MoklyError(
            "review-invalid",
            `invalid document resource for ${entry.path}: ${resource}`,
          );
        return route;
      }),
    );
    for (const scheme of entry.colorSchemes)
      index.set(documentRoute(entry.path, scheme), resources);
  }
  return index;
}

/** Include attachments still linked in the normalized document, respecting ignored regions. */
export function linkedDocumentResources(
  source: string,
  html: string,
  index: DocumentResourceIndex,
): readonly string[] {
  const declared = index.get(source);
  if (!declared?.size) return [];
  return [
    ...new Set(
      extractHtmlReferences(html, { resourceHints: false }).hrefs.flatMap(
        (href) => {
          const route = resolveResourceReference(source, href);
          return route && declared.has(route) ? [route] : [];
        },
      ),
    ),
  ].sort();
}
