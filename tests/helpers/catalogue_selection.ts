/** Select real catalogue entries without giving credit for an assertion. */
import assert from "node:assert/strict";

import type { ManifestEntry } from "../../packages/viewer/dist/registry/types.js";

type EntryKind = ManifestEntry["kind"];
type EntryOfKind<Kind extends EntryKind> = Extract<
  ManifestEntry,
  { kind: Kind }
>;
type VariantFilter = "include" | "exclude" | "only";
interface Catalogue {
  readonly entries: readonly ManifestEntry[];
}
interface MinimumOptions {
  min?: number;
}
interface UnderOptions extends MinimumOptions {
  kind?: EntryKind | readonly EntryKind[];
  variants?: VariantFilter;
}
interface SelectionFailure {
  helper: string;
  target: string;
  kind?: EntryKind | readonly EntryKind[] | undefined;
  variants?: VariantFilter;
  matches: number;
  reason: string;
}

/** A failed selection precondition, which is never an assertion. */
export class CatalogueSelectionError extends Error {
  /** Report the selected area, filters, count, and failure reason. */
  constructor(failure: SelectionFailure) {
    const kind = failure.kind;
    const kindText =
      kind === undefined
        ? "all"
        : typeof kind === "string"
          ? kind
          : kind.join(",");
    super(
      `${failure.helper}: "${failure.target}"; kind=${kindText}; ` +
        `variants=${failure.variants ?? "include"}; matches=${failure.matches}; ${failure.reason}`,
    );
    this.name = "CatalogueSelectionError";
  }
}

function matchesKind(
  entry: ManifestEntry,
  kind: EntryKind | readonly EntryKind[] | undefined,
): boolean {
  if (kind === undefined) return true;
  return typeof kind === "string"
    ? entry.kind === kind
    : kind.some((candidate) => candidate === entry.kind);
}

function selectEntry(
  manifest: Catalogue,
  path: string,
  kind: EntryKind | undefined,
  helper: "entryAt" | "entriesAt",
): ManifestEntry {
  const entry = manifest.entries.find((candidate) => candidate.path === path);
  if (entry === undefined || !matchesKind(entry, kind))
    throw new CatalogueSelectionError({
      helper,
      target: path,
      kind,
      matches: 0,
      reason: entry === undefined ? "missing path" : `found kind=${entry.kind}`,
    });
  return entry;
}

/** Find one entry and narrow its type to the required kind. */
export function entryAt<Kind extends EntryKind>(
  manifest: Catalogue,
  path: string,
  kind: Kind,
): EntryOfKind<Kind>;
/** Find one entry, optionally checking its kind. */
export function entryAt(
  manifest: Catalogue,
  path: string,
  kind?: EntryKind,
): ManifestEntry;
/** Reject a missing or wrong-kind path without making an assertion. */
export function entryAt(
  manifest: Catalogue,
  path: string,
  kind?: EntryKind,
): ManifestEntry {
  return selectEntry(manifest, path, kind, "entryAt");
}

/** Select requested paths in order and narrow them to the required kind. */
export function entriesAt<Kind extends EntryKind>(
  manifest: Catalogue,
  paths: readonly string[],
  kind: Kind,
): EntryOfKind<Kind>[];
/** Select requested paths in order, optionally checking their kind. */
export function entriesAt(
  manifest: Catalogue,
  paths: readonly string[],
  kind?: EntryKind,
): ManifestEntry[];
/** Reject missing, duplicate, or wrong-kind paths before returning entries. */
export function entriesAt(
  manifest: Catalogue,
  paths: readonly string[],
  kind?: EntryKind,
): ManifestEntry[] {
  const selected: ManifestEntry[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path))
      throw new CatalogueSelectionError({
        helper: "entriesAt",
        target: path,
        kind,
        matches: selected.filter((entry) => entry.path === path).length,
        reason: "duplicate requested path",
      });
    selected.push(selectEntry(manifest, path, kind, "entriesAt"));
    seen.add(path);
  }
  return selected;
}

/** Select a folder's entries and narrow them to one kind or a list of kinds. */
export function entriesUnder<Kind extends EntryKind>(
  manifest: Catalogue,
  folder: string,
  options: UnderOptions & { kind: Kind | readonly Kind[] },
): EntryOfKind<Kind>[];
/** Select a folder's entries with checked kind, variant, and count filters. */
export function entriesUnder(
  manifest: Catalogue,
  folder: string,
  options?: UnderOptions,
): ManifestEntry[];
/** Return matching original objects in manifest order or fail the precondition. */
export function entriesUnder(
  manifest: Catalogue,
  folder: string,
  options: UnderOptions = {},
): ManifestEntry[] {
  const variants = options.variants ?? "include";
  const selected = manifest.entries.filter(
    (entry) =>
      entry.path.startsWith(`${folder}/`) &&
      matchesKind(entry, options.kind) &&
      (variants === "include" ||
        "variantOf" in entry === (variants === "only")),
  );
  const min = options.min ?? 1;
  if (selected.length < min)
    throw new CatalogueSelectionError({
      helper: "entriesUnder",
      target: folder,
      kind: options.kind,
      variants,
      matches: selected.length,
      reason: `expected at least ${min} entries`,
    });
  return selected;
}

/** Select original entries by predicate with a named minimum-count check. */
export function entriesWhere(
  manifest: Catalogue,
  description: string,
  predicate: (entry: ManifestEntry) => boolean,
  options: MinimumOptions = {},
): ManifestEntry[] {
  const selected = manifest.entries.filter(predicate);
  const min = options.min ?? 1;
  if (selected.length < min)
    throw new CatalogueSelectionError({
      helper: "entriesWhere",
      target: description,
      matches: selected.length,
      reason: `expected at least ${min} entries`,
    });
  return selected;
}

/** Assert exact-path absence only after confirming a live anchor. */
export function assertAbsent(manifest: Catalogue, path: string): void {
  const separator = path.lastIndexOf("/");
  const anchor = separator === -1 ? path : path.slice(0, separator);
  const anchorEntries = manifest.entries.filter(
    (entry) => entry.path === anchor || entry.path.startsWith(`${anchor}/`),
  );
  if (anchorEntries.length === 0)
    throw new CatalogueSelectionError({
      helper: "assertAbsent",
      target: path,
      matches: 0,
      reason: `anchor "${anchor}" has no entries`,
    });
  const matches = manifest.entries.filter(
    (entry) => entry.path === path,
  ).length;
  assert.equal(
    matches,
    0,
    `assertAbsent: "${path}"; kind=all; variants=include; matches=${matches}; expected an absent path`,
  );
}
