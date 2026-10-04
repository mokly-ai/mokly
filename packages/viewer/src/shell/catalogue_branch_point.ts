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
  resolve(reference: EntryReference): EntryResolution | undefined;
  counterpart(current: EntryIdentity): EntryIdentity | undefined;
  parent(variant: EntryResolution): VariantParentResolution | undefined;
  previousPath(current: EntryIdentity): string | undefined;
}

/**
 * Index validated inputs once. Baseline entries are optional; without them,
 * only accepted pairs can prove a counterpart. No input is rewritten.
 */
export function createBranchPointLookup(
  catalogue: Pick<Catalogue, "manifest" | "removedEntries" | "previousPaths">,
  baseline: readonly EntryIdentity[] = [],
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
  const before = new Map(baseline.map((entry) => [identityKey(entry), entry]));
  const moved = new Map<string, CatalogueManifestEntry>();
  const previous = new Map<string, string>();
  for (const entry of catalogue.manifest.entries) {
    const previousPath = catalogue.previousPaths.get(entry.path);
    if (previousPath === undefined) continue;
    moved.set(identityKey({ kind: entry.kind, path: previousPath }), entry);
    previous.set(identityKey(entry), previousPath);
  }

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

  return {
    resolve,
    counterpart(reference) {
      const key = identityKey(reference);
      const entry = current.get(key);
      if (!entry) return undefined;
      const previousPath = previous.get(key);
      if (previousPath !== undefined)
        return { kind: entry.kind, path: previousPath };
      const counterpart = before.get(key);
      return counterpart
        ? { kind: counterpart.kind, path: counterpart.path }
        : undefined;
    },
    parent(variant) {
      const { entry } = variant;
      if (!("variantOf" in entry) || entry.variantOf === undefined)
        return undefined;
      const parent = resolve({
        side: variant.source === "current" ? "after" : "before",
        kind: entry.kind,
        path: entry.variantOf,
      });
      if (
        parent &&
        (!("variantOf" in parent.entry) || parent.entry.variantOf === undefined)
      )
        return parent;
      return variant.source === "removed" &&
        variant.record.parentTitle !== undefined
        ? { source: "title", title: variant.record.parentTitle }
        : undefined;
    },
    previousPath: (reference) => previous.get(identityKey(reference)),
  };
}

function identityKey(entry: EntryIdentity): string {
  return `${entry.kind}:${entry.path.toLowerCase()}`;
}
