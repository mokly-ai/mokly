import {
  canonicalJson,
  analyzeHierarchy,
  type CatalogueHierarchy,
} from "@mokly/viewer/data";
import type {
  Manifest,
  ManifestEntry,
  EntryChangeReason,
  ReviewEntryAddress,
} from "@mokly/viewer/data";

export type RoutedEntry = Exclude<
  ManifestEntry,
  { kind: "collection" | "page" }
>;
export const address = (entry: RoutedEntry): ReviewEntryAddress => ({
  id: entry.id,
  route: entry.route,
  title: entry.title,
});
export const lexical = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
export function entryPairs(
  before: Manifest,
  after: Manifest,
): { before: RoutedEntry | undefined; after: RoutedEntry | undefined }[] {
  const key = (entry: RoutedEntry) =>
    `${entry.kind}:${entry.kind === "component" ? entry.id : entry.route}`;
  const bases = new Map(
    before.entries.flatMap((entry) =>
      entry.kind === "collection" || entry.kind === "page"
        ? []
        : [[key(entry), entry] as const],
    ),
  );
  const heads = new Map(
    after.entries.flatMap((entry) =>
      entry.kind === "collection" || entry.kind === "page"
        ? []
        : [[key(entry), entry] as const],
    ),
  );
  return [...new Set([...bases.keys(), ...heads.keys()])]
    .sort()
    .map((id) => ({ before: bases.get(id), after: heads.get(id) }));
}
export function metadata(
  entry: RoutedEntry,
  manifest: Manifest,
  hierarchy: CatalogueHierarchy<ManifestEntry> = analyzeHierarchy<ManifestEntry>(
    manifest.entries,
  ).hierarchy,
): string {
  const ancestors = hierarchy.ancestorsById
    .get(entry.id)
    ?.map(({ id, title }) => ({ id, title }));
  const {
    dependencies: _dependencies,
    declaredDependencies: _declaredDependencies,
    sourcePath: _source,
    navPath: _navPath,
    ...common
  } = entry;
  if (entry.kind === "component") {
    const {
      variants: _variants,
      ownedDependencies: _ownedDependencies,
      ...component
    } = common as typeof entry;
    return canonicalJson({
      ...component,
      ancestors,
      variants: entry.variants.map(
        ({ componentViews: _views, ...variant }) => variant,
      ),
    });
  }
  if (entry.kind === "screen") {
    const { componentViews: _views, ...screen } = common as typeof entry;
    return canonicalJson({ ...screen, ancestors });
  }
  return canonicalJson({ ...common, ancestors });
}

export function uniqueReasons(
  reasons: readonly EntryChangeReason[],
): EntryChangeReason[] {
  const merged = new Map<string, EntryChangeReason>();
  for (const reason of reasons) {
    const key = `${reason.kind}:${"path" in reason ? reason.path : "route" in reason ? reason.route : ""}`;
    const previous = merged.get(key);
    if (reason.kind === "dependency" && previous?.kind === "dependency") {
      const analyses = [previous.analysis, reason.analysis].filter(
        (analysis) => analysis !== undefined,
      );
      if (analyses.length) {
        merged.set(key, {
          ...reason,
          analysis: {
            status: analyses.some(
              (analysis) => analysis.status === "unresolved",
            )
              ? "unresolved"
              : "matched",
            selectors: [
              ...new Set(analyses.flatMap((analysis) => analysis.selectors)),
            ].sort(),
          },
        });
        continue;
      }
    }
    merged.set(key, reason);
  }
  return [...merged.values()].sort(
    (a, b) =>
      lexical(a.kind, b.kind) ||
      lexical(
        "path" in a ? a.path : "route" in a ? a.route : "",
        "path" in b ? b.path : "route" in b ? b.route : "",
      ),
  );
}
