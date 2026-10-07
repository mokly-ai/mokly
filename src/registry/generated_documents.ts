import {
  documentRoute,
  entryRoute,
  generatedViews,
  type ManifestEntry,
} from "@mokly/viewer/data";

/** Exact generated HTML routes; shell-only entries have no document output. */
export function generatedDocumentRoutes(
  entries: readonly ManifestEntry[],
): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === "page") return [entryRoute(entry.path)];
    if (entry.kind === "document")
      return entry.colorSchemes.map((scheme) =>
        documentRoute(entry.path, scheme),
      );
    return generatedViews(entry).map((view) => view.path);
  });
}
