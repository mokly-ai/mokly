import type { ManifestEntry } from "@mokly/viewer/data";

/** Resolve discovered document references while retaining ordinary repository labels. */
export function relatedDocumentReferences(
  entries: readonly ManifestEntry[],
  mapPath: (path: string) => string = (path) => path,
): (source: string) => string {
  const documents = new Map(
    entries.flatMap((entry) =>
      entry.kind === "document"
        ? [[entry.sourcePath, `mock:${mapPath(entry.path)}`] as const]
        : [],
    ),
  );
  return (source) => documents.get(source) ?? source;
}
