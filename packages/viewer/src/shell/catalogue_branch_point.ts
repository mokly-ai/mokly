/** Pure identity lookup for one validated catalogue and its accepted pairs. */

import type { ManifestEntry } from "../registry/types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import type { RemovedEntrySnapshot } from "./metadata.js";

/** Kind is part of identity; paths compare under case folding. */
export interface EntryIdentity {
  readonly path: string;
  readonly kind: ManifestEntry["kind"];
}

/** Evidence keeps its original path and states which catalogue side owns it. */
export interface EntryReference extends EntryIdentity {
  readonly side: "before" | "after";
}

/** A removed destination retains its snapshot and former display context. */
export type EntryResolution =
  | { readonly source: "current"; readonly entry: CatalogueManifestEntry }
  | {
      readonly source: "removed";
      readonly entry: CatalogueManifestEntry;
      readonly record: RemovedEntrySnapshot;
    };

/** A title fallback has no destination or workspace identity. */
export type VariantParentResolution =
  EntryResolution | { readonly source: "title"; readonly title: string };

/** Shared operations for links, variants, inputs, workspace keys and crumbs. */
export interface BranchPointLookup {
  /** Resolve a sided reference: its pair, its path, then a removed record. */
  resolve(reference: EntryReference): EntryResolution | undefined;
  /**
   * A current entry's baseline identity: its accepted pair, else the
   * case-folded match in a supplied baseline inventory, in that spelling.
   */
  counterpart(
    current: EntryIdentity,
    baseline?: readonly EntryIdentity[],
  ): EntryIdentity | undefined;
  /** The inventory entry at a current entry's counterpart identity. */
  baselineEntry<T extends EntryIdentity>(
    current: EntryIdentity,
    baseline: readonly T[],
  ): T | undefined;
  /** A resolved variant's eligible same-kind parent, or its stored title. */
  parent(variant: EntryResolution): VariantParentResolution | undefined;
  /** The parent of the current entry or removed record at one identity. */
  parentOf(variant: EntryIdentity): VariantParentResolution | undefined;
  /** The previous path of a paired current entry only. */
  previousPath(current: EntryIdentity): string | undefined;
  /** Removed variants whose parent resolves to `parent`, in record order. */
  removedVariants(parent: EntryIdentity): readonly RemovedEntrySnapshot[];
}

/** The validated inputs one catalogue generation contributes. */
type BranchPointInputs = Pick<
  Catalogue,
  "manifest" | "removedEntries" | "previousPaths"
>;

const lookups = new WeakMap<BranchPointInputs, BranchPointLookup>();

/**
 * The one lookup of a catalogue generation, built on first use. Every shell
 * reaches branch-point identities through it rather than its own index.
 */
export function branchPoints(catalogue: BranchPointInputs): BranchPointLookup {
  const known = lookups.get(catalogue);
  if (known) return known;
  const lookup = createBranchPointLookup(catalogue);
  lookups.set(catalogue, lookup);
  return lookup;
}

/**
 * Index validated inputs once. Without a supplied baseline inventory, only
 * accepted pairs can prove a counterpart. No input is rewritten.
 */
function createBranchPointLookup(
  catalogue: BranchPointInputs,
): BranchPointLookup {
  const current = new Map(
    catalogue.manifest.entries.map((entry) => [identityKey(entry), entry]),
  );
  const removed = new Map(
    catalogue.removedEntries.map((record) => [
      identityKey(record.entry),
      record,
    ]),
  );
  const moved = new Map<string, CatalogueManifestEntry>();
  const previous = new Map<string, string>();
  for (const entry of catalogue.manifest.entries) {
    const previousPath = catalogue.previousPaths.get(entry.path);
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

  const resolve = (reference: EntryReference): EntryResolution | undefined => {
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
  const locate = (identity: EntryIdentity): EntryResolution | undefined => {
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
    variant: EntryResolution,
  ): VariantParentResolution | undefined => {
    const { entry } = variant;
    if (!("variantOf" in entry) || entry.variantOf === undefined)
      return undefined;
    const resolved = resolve({
      side: variant.source === "current" ? "after" : "before",
      kind: entry.kind,
      path: entry.variantOf,
    });
    if (
      resolved &&
      (!("variantOf" in resolved.entry) ||
        resolved.entry.variantOf === undefined)
    )
      return resolved;
    return variant.source === "removed" &&
      variant.record.parentTitle !== undefined
      ? { source: "title", title: variant.record.parentTitle }
      : undefined;
  };
  const adopted = new Map<string, RemovedEntrySnapshot[]>();
  for (const record of catalogue.removedEntries) {
    const owner = parent({ source: "removed", entry: record.entry, record });
    if (owner === undefined || owner.source === "title") continue;
    const key = identityKey(owner.entry);
    adopted.set(key, [...(adopted.get(key) ?? []), record]);
  }

  return {
    resolve,
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
