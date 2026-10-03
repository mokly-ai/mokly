import { canonicalJson, isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  Manifest,
  ManifestEntry,
  HistoricalManifestEntry,
  EntryChangeReason,
  ReviewEntryAddress,
} from "@mokly/viewer/data";

export type ReviewEntry = Exclude<
  ManifestEntry | HistoricalManifestEntry,
  { kind: "page" }
>;
export const address = (entry: ReviewEntry): ReviewEntryAddress => ({
  id: entry.id,
  title: entry.title,
});
/** Pair every reviewable entry by its globally stable id. */
export function entryPairKey(entry: ReviewEntry): string {
  return `${entry.kind}:${entry.id}`;
}
export const lexical = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
/** Drop baseline identities that the current catalogue reuses for another kind. */
export function baselineForCurrentIdentities(
  before: Manifest,
  after: Manifest,
): Manifest {
  const currentKinds = new Map(
    after.entries.map((entry) => [entry.id, entry.kind] as const),
  );
  const entries = before.entries.filter((entry) => {
    const currentKind = currentKinds.get(entry.id);
    return currentKind === undefined || currentKind === entry.kind;
  });
  return entries.length === before.entries.length
    ? before
    : { ...before, entries };
}
export function entryPairs(
  before: Manifest,
  after: Manifest,
): { before: ReviewEntry | undefined; after: ReviewEntry | undefined }[] {
  const bases = new Map(
    before.entries.flatMap((entry) =>
      entry.kind === "page" ||
      (entry.kind === "component" && isManifestComponentVariant(entry))
        ? []
        : [[entryPairKey(entry), entry] as const],
    ),
  );
  const heads = new Map(
    after.entries.flatMap((entry) =>
      entry.kind === "page" ||
      (entry.kind === "component" && isManifestComponentVariant(entry))
        ? []
        : [[entryPairKey(entry), entry] as const],
    ),
  );
  return [...new Set([...bases.keys(), ...heads.keys()])]
    .sort()
    .map((id) => ({ before: bases.get(id), after: heads.get(id) }));
}
export function metadata(entry: ReviewEntry): string {
  const navPath = entry.navPath;
  const common = { ...entry } as Record<string, unknown>;
  for (const field of ["componentViews", "navPath", "sourcePath"])
    Reflect.deleteProperty(common, field);
  if (entry.kind === "component") {
    return canonicalJson({ ...common, navPath });
  }
  return canonicalJson({ ...common, navPath });
}

export function uniqueReasons(
  reasons: readonly EntryChangeReason[],
): EntryChangeReason[] {
  const merged = new Map<string, EntryChangeReason>();
  for (const reason of reasons) {
    const key = `${reason.kind}:${"path" in reason ? reason.path : "id" in reason ? reason.id : ""}`;
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
        "path" in a ? a.path : "id" in a ? a.id : "",
        "path" in b ? b.path : "id" in b ? b.id : "",
      ),
  );
}
