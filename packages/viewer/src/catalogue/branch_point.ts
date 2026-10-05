/** Pure lookup for one validated catalogue generation and its accepted pairs. */

import type {
  BranchPointEntry,
  BranchPointInputs,
  BranchPointLookup,
  BranchPointRemovedEntry,
  EntryIdentity,
  EntryReference,
  EntryResolution,
  VariantParentResolution,
} from "./branch_point_types.js";

const lookups = new WeakMap<object, unknown>();

/** Index a generation on first use, retaining each input entry and record. */
export function branchPoints<
  Entry extends BranchPointEntry,
  Removed extends BranchPointRemovedEntry<Entry>,
>(
  catalogue: BranchPointInputs<Entry, Removed>,
): BranchPointLookup<Entry, Removed> {
  const known = lookups.get(catalogue) as
    BranchPointLookup<Entry, Removed> | undefined;
  if (known) return known;
  const lookup = createBranchPointLookup(catalogue);
  lookups.set(catalogue, lookup);
  return lookup;
}

function createBranchPointLookup<
  Entry extends BranchPointEntry,
  Removed extends BranchPointRemovedEntry<Entry>,
>(
  catalogue: BranchPointInputs<Entry, Removed>,
): BranchPointLookup<Entry, Removed> {
  const entries =
    "manifest" in catalogue
      ? catalogue.manifest.entries
      : [
          ...catalogue.screens,
          ...catalogue.pages,
          ...catalogue.documents,
          ...catalogue.useCases,
          ...catalogue.components,
        ];
  const current = new Map(entries.map((entry) => [identityKey(entry), entry]));
  const removed = new Map(
    catalogue.removedEntries.map((record) => [
      identityKey(record.entry),
      record,
    ]),
  );
  const moved = new Map<string, Entry>();
  const previous = new Map<string, string>();
  const pairs =
    "manifest" in catalogue
      ? new Map(
          catalogue.moves?.map((pair) => [
            identityKey(pair),
            pair.previousPath,
          ]),
        )
      : undefined;
  for (const entry of entries) {
    const previousPath =
      "manifest" in catalogue
        ? (pairs?.get(identityKey(entry)) ??
          catalogue.previousPaths?.get(entry.path))
        : entry.previousPath;
    if (previousPath === undefined) continue;
    moved.set(identityKey({ kind: entry.kind, path: previousPath }), entry);
    previous.set(identityKey(entry), previousPath);
  }
  const inventories = new WeakMap<
    readonly EntryIdentity[],
    ReadonlyMap<string, number>
  >();
  const position = (
    baseline: readonly EntryIdentity[],
    identity: EntryIdentity,
  ): number | undefined => {
    const known = inventories.get(baseline);
    const index =
      known ??
      new Map(baseline.map((entry, at) => [identityKey(entry), at] as const));
    if (!known) inventories.set(baseline, index);
    return index.get(identityKey(identity));
  };

  const resolve = (
    reference: EntryReference,
  ): EntryResolution<Entry, Removed> | undefined => {
    const key = identityKey(reference);
    const entry =
      (reference.side === "before" ? moved.get(key) : undefined) ??
      current.get(key);
    if (entry) return { source: "current", entry };
    const record = reference.side === "before" ? removed.get(key) : undefined;
    return record
      ? { source: "removed", entry: record.entry, record }
      : undefined;
  };
  const locate = (
    identity: EntryIdentity,
  ): EntryResolution<Entry, Removed> | undefined => {
    const key = identityKey(identity);
    const entry = current.get(key);
    if (entry) return { source: "current", entry };
    const record = removed.get(key);
    return record
      ? { source: "removed", entry: record.entry, record }
      : undefined;
  };
  const counterpart = (
    reference: EntryIdentity,
    baseline: readonly EntryIdentity[] = [],
  ): EntryIdentity | undefined => {
    const key = identityKey(reference);
    const entry = current.get(key);
    if (!entry) return undefined;
    const previousPath = previous.get(key);
    if (previousPath !== undefined)
      return { kind: entry.kind, path: previousPath };
    const at = position(baseline, reference);
    const match = at === undefined ? undefined : baseline[at];
    return match ? { kind: match.kind, path: match.path } : undefined;
  };
  const parent = (
    variant: EntryResolution<Entry, Removed>,
  ): VariantParentResolution<Entry, Removed> | undefined => {
    const { entry } = variant;
    if (entry.variantOf === undefined) return undefined;
    const resolved = resolve({
      side: variant.source === "current" ? "after" : "before",
      kind: entry.kind,
      path: entry.variantOf,
    });
    if (resolved && resolved.entry.variantOf === undefined) return resolved;
    return variant.source === "removed" &&
      variant.record.parentTitle !== undefined
      ? { source: "title", title: variant.record.parentTitle }
      : undefined;
  };
  const adopted = new Map<string, Removed[]>();
  for (const record of catalogue.removedEntries) {
    const owner = parent({ source: "removed", entry: record.entry, record });
    if (owner === undefined || owner.source === "title") continue;
    const key = identityKey(owner.entry);
    adopted.set(key, [...(adopted.get(key) ?? []), record]);
  }
  return {
    resolve,
    usageComponent(name, side) {
      const resolved = resolve({ kind: "component", path: name, side });
      return resolved && resolved.entry.variantOf === undefined
        ? resolved
        : undefined;
    },
    counterpart,
    baselineEntry(reference, baseline) {
      const identity = counterpart(reference, baseline);
      const at = identity && position(baseline, identity);
      return at === undefined ? undefined : baseline[at];
    },
    parent,
    parentOf(variant) {
      const own = locate(variant);
      return own && parent(own);
    },
    previousPath: (reference) => previous.get(identityKey(reference)),
    removedVariants: (owner) => adopted.get(identityKey(owner)) ?? [],
  };
}

function identityKey(entry: EntryIdentity): string {
  return `${entry.kind}:${entry.path.toLowerCase()}`;
}
