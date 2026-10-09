import {
  canonicalJson,
  isManifestComponentVariant,
  mergeCssAnalysis,
} from "@mokly/viewer/data";
import type {
  Manifest,
  ManifestEntry,
  HistoricalManifestEntry,
  EntryChangeReason,
  ReviewEntryAddress,
} from "@mokly/viewer/data";

import type { EntryMove } from "./moves/types.js";

export type ReviewEntry = Exclude<
  ManifestEntry | HistoricalManifestEntry,
  { kind: "page" | "document" }
>;
export const address = (entry: ReviewEntry): ReviewEntryAddress => ({
  path: entry.path,
  title: entry.title,
});
/** Pair every reviewable entry by its case-folded kind and path. */
export function entryPairKey(entry: ReviewEntry): string {
  return `${entry.kind}:${entry.path.toLowerCase()}`;
}
export const lexical = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
/** Drop baseline identities that the current catalogue reuses for another kind. */
export function baselineForCurrentIdentities(
  before: Manifest,
  after: Manifest,
  moves: readonly EntryMove[] = [],
): Manifest {
  const moved = new Set(
    moves.map((move) => `${move.kind}:${move.previousPath.toLowerCase()}`),
  );
  const currentKinds = new Map(
    after.entries.map(
      (entry) => [entry.path.toLowerCase(), entry.kind] as const,
    ),
  );
  const entries = before.entries.filter((entry) => {
    const currentKind = currentKinds.get(entry.path.toLowerCase());
    return (
      currentKind === undefined ||
      currentKind === entry.kind ||
      moved.has(`${entry.kind}:${entry.path.toLowerCase()}`)
    );
  });
  return entries.length === before.entries.length
    ? before
    : { ...before, entries };
}
export function entryPairs(
  before: Manifest,
  after: Manifest,
  moves: readonly EntryMove[] = [],
): { before: ReviewEntry | undefined; after: ReviewEntry | undefined }[] {
  const moved = new Map(
    moves.map((move) => [
      `${move.kind}:${move.previousPath.toLowerCase()}`,
      `${move.kind}:${move.path.toLowerCase()}`,
    ]),
  );
  const bases = new Map(
    before.entries.flatMap((entry) =>
      entry.kind === "page" || entry.kind === "document"
        ? []
        : [
            [
              moved.get(entryPairKey(entry)) ?? entryPairKey(entry),
              entry,
            ] as const,
          ],
    ),
  );
  const heads = new Map(
    after.entries.flatMap((entry) =>
      entry.kind === "page" || entry.kind === "document"
        ? []
        : [[entryPairKey(entry), entry] as const],
    ),
  );
  return [...new Set([...bases.keys(), ...heads.keys()])]
    .sort()
    .map((id) => ({ before: bases.get(id), after: heads.get(id) }));
}
export function metadata(
  entry: ReviewEntry,
  mapPath: (path: string) => string = (path) => path,
  mapDocument: (source: string) => string = (source) => source,
): string {
  const common = { ...entry } as Record<string, unknown>;
  for (const field of ["componentViews", "sourcePath", "movedFrom"])
    Reflect.deleteProperty(common, field);
  common.path = mapPath(entry.path).toLowerCase();
  common.relatedDocs = entry.relatedDocs.map(mapDocument);
  if (typeof common.variantOf === "string")
    common.variantOf = mapPath(common.variantOf).toLowerCase();
  if (entry.kind === "screen")
    common.useCasePaths = entry.useCasePaths.map(mapPath);
  if (entry.kind === "use-case")
    common.steps = entry.steps.map((step) => ({
      ...step,
      screenPath: mapPath(step.screenPath),
    }));
  return canonicalJson(common);
}

/** A variant also displays its owning entry's title, independently of its own title. */
export function variantParentTitleChanged(
  beforeEntry: ReviewEntry,
  afterEntry: ReviewEntry,
  before: Manifest,
  after: Manifest,
): boolean {
  const parent = (entry: ReviewEntry) =>
    entry.kind === "screen" ||
    (entry.kind === "component" && isManifestComponentVariant(entry))
      ? entry.variantOf
      : undefined;
  const left = parent(beforeEntry),
    right = parent(afterEntry);
  if (!left || !right) return false;
  return (
    before.entries.find(
      (entry) => entry.kind === beforeEntry.kind && entry.path === left,
    )?.title !==
    after.entries.find(
      (entry) => entry.kind === afterEntry.kind && entry.path === right,
    )?.title
  );
}

export function uniqueReasons(
  reasons: readonly EntryChangeReason[],
): EntryChangeReason[] {
  const merged = new Map<string, EntryChangeReason>();
  for (const reason of reasons) {
    const key = `${reason.kind}:${"path" in reason ? reason.path : "screenPath" in reason ? reason.screenPath : ""}`;
    const previous = merged.get(key);
    if (reason.kind === "dependency" && previous?.kind === "dependency") {
      const analyses = [previous.analysis, reason.analysis].filter(
        (analysis) => analysis !== undefined,
      );
      if (analyses.length) {
        merged.set(key, {
          ...reason,
          analysis: mergeCssAnalysis(analyses),
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
        "path" in a ? a.path : "screenPath" in a ? a.screenPath : "",
        "path" in b ? b.path : "screenPath" in b ? b.screenPath : "",
      ),
  );
}
