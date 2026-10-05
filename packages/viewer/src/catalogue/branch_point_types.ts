/** Sided identity operations shared by projection, readers and presentation. */

import type {
  HistoricalManifestEntry,
  ManifestEntry,
} from "../registry/types.js";

/** Kind is part of identity; paths compare under case folding. */
export interface EntryIdentity {
  readonly path: string;
  readonly kind: ManifestEntry["kind"];
}

/** Evidence retains its original path and names the side that owns it. */
export interface EntryReference extends EntryIdentity {
  readonly side: "before" | "after";
}

/** Optional relationships carried by each validated input record. */
export interface BranchPointEntry extends EntryIdentity {
  readonly variantOf?: string;
  readonly previousPath?: string;
}

type ManifestRecord = ManifestEntry | HistoricalManifestEntry;

/** Removed inputs retain their original record and historical display context. */
export interface BranchPointRemovedEntry<
  Entry extends EntryIdentity = ManifestRecord,
> {
  readonly entry: Entry;
  readonly parentTitle?: string;
  readonly snapshotId?: string;
}

/** A removed destination retains its snapshot and former display context. */
export type EntryResolution<
  Entry extends EntryIdentity = ManifestRecord,
  Removed extends BranchPointRemovedEntry<Entry> =
    BranchPointRemovedEntry<Entry>,
> =
  | { readonly source: "current"; readonly entry: Entry }
  | {
      readonly source: "removed";
      readonly entry: Entry;
      readonly record: Removed;
    };

/** A title fallback has no destination or workspace identity. */
export type VariantParentResolution<
  Entry extends EntryIdentity = ManifestRecord,
  Removed extends BranchPointRemovedEntry<Entry> =
    BranchPointRemovedEntry<Entry>,
> =
  | EntryResolution<Entry, Removed>
  | { readonly source: "title"; readonly title: string };

/** Shared operations for links, variants, usage names, inputs and workspace keys. */
export interface BranchPointLookup<
  Entry extends EntryIdentity = ManifestRecord,
  Removed extends BranchPointRemovedEntry<Entry> =
    BranchPointRemovedEntry<Entry>,
> {
  /** Resolve a sided reference: its pair, its path, then a removed record. */
  resolve(
    reference: EntryReference,
  ): EntryResolution<Entry, Removed> | undefined;
  /** Resolve a usage name to a component parent on the stated side. */
  usageComponent(
    name: string,
    side: EntryReference["side"],
  ): EntryResolution<Entry, Removed> | undefined;
  /** The accepted pair, else the case-folded baseline match in its spelling. */
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
  parent(
    variant: EntryResolution<Entry, Removed>,
  ): VariantParentResolution<Entry, Removed> | undefined;
  /** Locate the current entry or removed record, then resolve its parent. */
  parentOf(
    variant: EntryIdentity,
  ): VariantParentResolution<Entry, Removed> | undefined;
  /** The previous path of a paired current entry only. */
  previousPath(current: EntryIdentity): string | undefined;
  /** Removed variants whose parent resolves to this identity, in record order. */
  removedVariants(parent: EntryIdentity): readonly Removed[];
}

/** Private catalogues and public read models supply the same validated inputs. */
export type BranchPointInputs<
  Entry extends BranchPointEntry,
  Removed extends BranchPointRemovedEntry<Entry>,
> = {
  readonly removedEntries: readonly Removed[];
} & (
  | {
      readonly manifest: { readonly entries: readonly Entry[] };
      readonly previousPaths?: ReadonlyMap<string, string>;
      readonly moves?: readonly (EntryIdentity & {
        readonly previousPath: string;
      })[];
    }
  | {
      readonly screens: readonly Entry[];
      readonly pages: readonly Entry[];
      readonly documents: readonly Entry[];
      readonly useCases: readonly Entry[];
      readonly components: readonly Entry[];
    }
);
