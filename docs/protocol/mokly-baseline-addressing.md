# Baseline Catalogue Discovery And Addressing

## Delivery Status

Only v10 content reaches a baseline reader. Earlier-version detection follows
the [manifest gate](./mokly-generated-manifest.md#historical-readers-and-layouts).
Implementation and verification are tracked by
[Generated Output Simplification](../../plans/generated-output-simplification.md).

## Per-Commit Descriptor

Both Git-blob and rebuilt v10 readers receive an immutable descriptor:

```ts
interface BaselineCatalogue {
  commit: string;
  layout: "generated-v10";
  catalogueRoot: string; // repository-relative historical mockupsDir
  generatedRoot: string; // catalogueRoot joined with GENERATED_DIRECTORY
}
```

A repository-root catalogue is `.`; never include `./` in Git requests. Roots
must be confined regular directories without symlink aliases. The descriptor
names the base's root, never today's configured root. The head uses the same
v10 layout at the current root. No descriptor or resource reader is constructed
for an earlier-version outcome.

At the requested root, inspect only
`mokly-generated/mokly-manifest.json` in the generated subtree. Complete v10
inventory selects Git blobs; a missing manifest or incomplete inventory selects
the base's own rebuild. A committed root-level manifest cannot suppress it.
The version check at the selected current location remains strict.

## Discovery After A Rebuild

After the base's own commands finish successfully and before adopting output:

1. Inspect `mokly-generated/mokly-manifest.json` at the requested root, then
   root-level `mokly-manifest.json` solely for the version check. The first
   existing file is authoritative. A valid v10 generated child selects that root.
   Earlier output immediately returns `baseline-incompatible-earlier`.
   Malformed/nonregular/newer output or v10 at the flat location fails
   `baseline-output-invalid`. Only an absent requested catalogue starts a search.
2. Walk the extraction in UTF-16 code-unit order. Exclude `.git`, `.mokly-cache`
   and `node_modules` at every depth. Never follow symlinks. Keep confined
   `lstat`, bounded manifest reads and the 65,536-entry traversal limit.
3. At each other directory inspect the canonical generated child, then the
   direct canonical name, without another filename. Keep valid v10 and recognized
   earlier envelopes as candidates. A malformed/newer preferred file makes that
   directory ineligible; do not try another manifest in it. Do not count a
   generated child again as a flat catalogue when its manifest belongs to its parent.
4. Require exactly one candidate across both classifications. Zero or several
   fail with `No unique historical catalogue after baseline build; candidates: <list>.`
   Use `(none)` for zero; otherwise sort `<root> (generated-v10)` or
   `<root> (incompatible-earlier)` by root/classification and join with comma-space.
   Current discovery therefore still treats a v10 match plus an earlier match as
   ambiguous. The pending precedence change below is not implemented yet.
5. A sole earlier candidate returns the typed earlier-baseline outcome without
   harvesting content or creating a descriptor. A sole v10 candidate selects its
   historical root and must pass complete generated-file and byte-hash verification.
   Missing/stale rebuilt output fails `baseline-output-invalid`; a no-op recipe
   cannot repair a bad inventory.

A moved v10 root therefore remains usable: when the requested root is empty,
the bounded search can find the one v10 generated child elsewhere. A rebuilt
old flat catalogue may be recognized only to report incompatibility, never as
an alternative content layout. Malformed data never becomes the graceful
older-version outcome.

## Cache Identity And Readers

`inputs.json` keeps the requested/current repo-relative `mockupsDir`, not the
discovered root. New schema-2 completion markers use `manifestVersion: 10`,
`historicalCatalogueRoot` and `layout: "generated-v10"`, alongside the existing
commit, finish time and command list. Validate those fields and the v10 manifest
on reuse; do not rediscover a root during a warm hit.

Cache output is always
`output/<historicalCatalogueRoot>/mokly-generated/` plus the authored closure
under `output/<historicalCatalogueRoot>/`. Each reader accepts a pinned commit
and repository-relative path, proves that the path belongs to the generated
set or authored closure under that descriptor, and reads a confined regular
file. The Git reader uses that path directly; the cache reader appends it to
`output/`. No reader strips a different root to access flat output.

A completed cache has one current format. The
[storage validator](./mokly-baseline-storage.md#cache-layout) returns a warm
entry only for matching complete v10 output. Invalid or incomplete entries are partial and are removed under the entry
lock before a rebuild. Different settings on a valid v10 entry fail intact. No older cache proves an
earlier-baseline outcome.

## Comparison Namespaces

Both accepted sides use v10 kind/path and view-axis addressing. Pair documents
by that identity, with generated paths derived by the shared route helpers;
read them beneath each side's own generated root. Generated stylesheet/asset
keys are generated-relative; authored resource keys are catalogue-relative.
These are separate namespaces even if their trailing strings are equal.

Resolve local HTML/CSS URLs against each referring file in its own root and
retain normal query/fragment, encoding, security and resource-membership rules.
A root move alone leaves these layout-relative addresses unchanged. Do not
normalize v2–v9 document hrefs into v10 ones, rewrite paired HTML to accommodate
an older layout, or use Git changed-path strings to locate a base resource.
Git paths remain source/dependency evidence only. Existing ordinary resource
resolution, materiality and CSS equivalence checks remain required.

Classification, selected comparisons, removed previews, component fast paths,
CSS attribution and export/publication capture consume this same v10 descriptor.
Snapshot publication retains its generation-local URLs; these are not a second
baseline storage layout. Earlier output supplies no snapshot or removed entry.

The pending [comparison inventory rules](./mokly-comparison-inventory.md)
refine moved-root selection: one valid v10 candidate wins over stale earlier
candidates. Multiple v10 candidates remain an error. With no v10 result, retain
the existing earlier-envelope/ambiguity outcomes and never cache incompatibility.

The approved [path/output integration](./mokly-path-output-integration.md)
defines the current path-derived layout. Its
[format inventory](./mokly-format-versions.md) defines manifest v10, catalogue v6,
review v7 and all other boundaries. Only v10 baseline content is readable; the earlier-version product outcome remains unchanged.
