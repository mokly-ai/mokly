/** Sided identity operations shared by projection, readers and presentation. */

import type { ManifestEntry } from "../registry/types.js";

import type { BeforePath, BranchPointPath, CurrentPath } from "./path_types.js";

/** Kind is part of identity; paths compare under case folding. */
export interface EntryIdentity<Path extends string = CurrentPath> {
  readonly path: Path;
  readonly kind: ManifestEntry["kind"];
}

/** Evidence retains its original path and names the side that owns it. */
export type EntryReference<
  Current extends string = CurrentPath,
  Before extends string = BranchPointPath,
> =
  | (EntryIdentity<Before> & { readonly side: "before" })
  | (EntryIdentity<Current> & { readonly side: "after" });

/** Optional relationships carried by each validated input record. */
export interface BranchPointEntry<
  Path extends string = CurrentPath,
  Reference extends string = Path,
  Before extends string = BeforePath<Path>,
> extends EntryIdentity<Path> {
  readonly variantOf?: Reference;
  readonly previousPath?: Before;
}

/** Removed inputs retain their original record and historical display context. */
export interface BranchPointRemovedEntry<
  Entry extends EntryIdentity<string> = ManifestEntry<
    CurrentPath,
    BranchPointPath
  >,
> {
  readonly entry: Entry;
  readonly parentTitle?: string;
  readonly snapshotId?: string;
}

/** A removed destination retains its snapshot and former display context. */
export type EntryResolution<
  Entry extends EntryIdentity<string> = ManifestEntry<CurrentPath>,
  Removed extends BranchPointRemovedEntry<EntryIdentity<string>> =
    BranchPointRemovedEntry,
> =
  | { readonly source: "current"; readonly entry: Entry }
  | {
      readonly source: "removed";
      readonly entry: Removed["entry"];
      readonly record: Removed;
    };

/** A title fallback has no destination or workspace identity. */
export type VariantParentResolution<
  Entry extends EntryIdentity<string> = ManifestEntry<CurrentPath>,
  Removed extends BranchPointRemovedEntry<EntryIdentity<string>> =
    BranchPointRemovedEntry,
> =
  | EntryResolution<Entry, Removed>
  | { readonly source: "title"; readonly title: string };

/** Shared operations for links, variants, usage names, inputs and workspace keys. */
export interface BranchPointLookup<
  Entry extends EntryIdentity<string> = ManifestEntry<CurrentPath>,
  Removed extends BranchPointRemovedEntry<
    BranchPointEntry<Entry["path"], string, string>
  > = BranchPointRemovedEntry<
    BranchPointEntry<Entry["path"], BeforePath<Entry["path"]>>
  >,
> {
  /** Resolve a sided reference: its pair, its path, then a removed record. */
  resolve(
    reference: EntryReference<Entry["path"], BeforePath<Entry["path"]>>,
  ): EntryResolution<Entry, Removed> | undefined;
  /** Locate an addressed current entry or removed record without following pairs. */
  at(
    current: EntryIdentity<Entry["path"]>,
  ): EntryResolution<Entry, Removed> | undefined;
  /** Resolve a usage name to a component parent on the stated side. */
  usageComponent(
    name: BeforePath<Entry["path"]> | Entry["path"],
    side: "before" | "after",
  ): EntryResolution<Entry, Removed> | undefined;
  /** The accepted pair, else the case-folded baseline match in its spelling. */
  counterpart(
    current: EntryIdentity<Entry["path"]>,
    baseline?: readonly EntryIdentity<BeforePath<Entry["path"]>>[],
  ): EntryIdentity<BeforePath<Entry["path"]>> | undefined;
  /** The inventory entry at a current entry's counterpart identity. */
  baselineEntry<T extends EntryIdentity<BeforePath<Entry["path"]>>>(
    current: EntryIdentity<Entry["path"]>,
    baseline: readonly T[],
  ): T | undefined;
  /** A resolved variant's eligible same-kind parent, or its stored title. */
  parent(
    variant: EntryResolution<Entry, Removed>,
  ): VariantParentResolution<Entry, Removed> | undefined;
  /** Locate the current entry or removed record, then resolve its parent. */
  parentOf(
    variant: EntryIdentity<Entry["path"]>,
  ): VariantParentResolution<Entry, Removed> | undefined;
  /** The previous path of a paired current entry only. */
  previousPath(
    current: EntryIdentity<Entry["path"]>,
  ): BeforePath<Entry["path"]> | undefined;
  /** Removed variants whose parent resolves to this identity, in record order. */
  removedVariants(parent: EntryIdentity<Entry["path"]>): readonly Removed[];
}

/** Private catalogues and public read models supply the same validated inputs. */
export type BranchPointInputs<
  Entry extends BranchPointEntry<string, string, string>,
  Removed extends BranchPointRemovedEntry<
    BranchPointEntry<Entry["path"], string, string>
  >,
> = {
  readonly removedEntries: readonly Removed[];
} & (
  | {
      readonly manifest: { readonly entries: readonly Entry[] };
      readonly previousPaths?: ReadonlyMap<
        Entry["path"],
        BeforePath<Entry["path"]>
      >;
      readonly moves?: readonly (EntryIdentity<Entry["path"]> & {
        readonly previousPath: BeforePath<Entry["path"]>;
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
