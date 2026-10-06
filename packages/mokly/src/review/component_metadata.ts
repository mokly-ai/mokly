import { minimatch } from "minimatch";

import type { ComponentViewRecord, ManifestComponent } from "@mokly/viewer";
import { canonicalJson, isManifestComponentVariant } from "@mokly/viewer/data";
import type {
  Manifest,
  ManifestEntry,
  HistoricalManifestEntry,
  EntryChangeReason,
  ReviewEntryAddress,
} from "@mokly/viewer/data";

import { dependencyContainsChangedPath } from "../registry/dependency_paths.js";

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
  mapSource: (source: string) => string = (source) => source,
): string {
  const common = { ...entry } as Record<string, unknown>;
  for (const field of [
    "componentViews",
    "declaredDependencies",
    "sourcePath",
    "movedFrom",
  ])
    Reflect.deleteProperty(common, field);
  common.path = mapPath(entry.path).toLowerCase();
  common.relatedDocs = entry.relatedDocs.map(mapDocument);
  if (entry.kind === "component" && !isManifestComponentVariant(entry))
    common.ownedDependencies = entry.ownedDependencies.map(mapSource).sort();
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

/** Track owners, exact reasons, and unowned path evidence across both manifests. */
export class ComponentDependencyPolicy {
  private readonly components: readonly ManifestComponent[];
  private readonly ownersByPath = new Map<string, ReadonlySet<string>>();
  private readonly sharedByPath = new Map<string, boolean>();
  constructor(
    before: Manifest,
    after: Manifest,
    private readonly shared: readonly string[],
  ) {
    this.components = [...before.entries, ...after.entries].filter(
      (entry): entry is ManifestComponent =>
        entry.kind === "component" && !isManifestComponentVariant(entry),
    );
  }
  owners(changed: string): ReadonlySet<string> {
    let owners = this.ownersByPath.get(changed);
    if (!owners) {
      owners = new Set(
        this.components.flatMap((entry) =>
          entry.ownedDependencies.some((root) =>
            dependencyContainsChangedPath(root, changed),
          )
            ? [entry.path]
            : [],
        ),
      );
      this.ownersByPath.set(changed, owners);
    }
    return owners;
  }
  independent(entry: ReviewEntry, changed: string): boolean {
    const owners = this.owners(changed);
    if (
      owners.has(entry.path) &&
      entry.kind === "component" &&
      !isManifestComponentVariant(entry)
    )
      return true;
    const declared = entry.declaredDependencies ?? [];
    return (
      declared.includes(changed) && (!owners.size || entry.kind === "screen")
    );
  }
  sharedPaths(changed: readonly string[]): string[] {
    return changed.filter((item) => this.sharedPath(item));
  }
  unownedEvidence(
    before: ReviewEntry | undefined,
    after: ReviewEntry | undefined,
    changed: readonly string[],
  ): string[] {
    return changed.filter(
      (item) =>
        !this.owners(item).size &&
        (this.sharedPath(item) ||
          [before, after].some((entry) =>
            entry?.declaredDependencies?.some((root) =>
              dependencyContainsChangedPath(root, item),
            ),
          )),
    );
  }
  reasons(
    before: ReviewEntry | undefined,
    after: ReviewEntry | undefined,
    changed: readonly string[],
  ): EntryChangeReason[] {
    return changed
      .filter((item) =>
        [before, after].some((entry) => entry && this.independent(entry, item)),
      )
      .map((path) => ({ kind: "dependency", path }));
  }
  private sharedPath(changed: string): boolean {
    let matches = this.sharedByPath.get(changed);
    if (matches === undefined) {
      matches = this.shared.some((glob) =>
        minimatch(changed, glob, { dot: true }),
      );
      this.sharedByPath.set(changed, matches);
    }
    return matches;
  }
  suppressResource(
    repoPath: string,
    publicPath: string,
    paired: ReadonlySet<string>,
    before?: ComponentViewRecord,
    after?: ComponentViewRecord,
    root?: string,
  ): boolean {
    if (!before || !after) return false;
    const owners = this.owners(repoPath);
    if (owners.size && [...owners].every((id) => id !== root && paired.has(id)))
      return true;
    const left = before.resources.find((item) => item.path === publicPath);
    const right = after.resources.find((item) => item.path === publicPath);
    return Boolean(
      left &&
      right &&
      canonicalJson(left.componentIds) === canonicalJson(right.componentIds) &&
      left.componentIds.every((id) => id !== root && paired.has(id)),
    );
  }
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
        "path" in a ? a.path : "screenPath" in a ? a.screenPath : "",
        "path" in b ? b.path : "screenPath" in b ? b.screenPath : "",
      ),
  );
}
