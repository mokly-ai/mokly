# Baseline Catalogue Discovery And Addressing

## Delivery Status

Only v8 content reaches a baseline reader. Earlier-version detection follows
the [manifest gate](./mokly-generated-manifest.md#historical-readers-and-layouts).
Implementation and verification are tracked by
[Generated Output Simplification](../../plans/generated-output-simplification.md).

## Per-Commit Descriptor

Both Git-blob and rebuilt v8 readers receive an immutable descriptor:

```ts
interface BaselineCatalogue {
  commit: string;
  layout: "generated-v8";
  catalogueRoot: string; // repository-relative historical mockupsDir
  generatedRoot: string; // catalogueRoot joined with GENERATED_DIRECTORY
}
```

A repository-root catalogue is `.`; never include `./` in Git requests. Roots
must be confined regular directories without symlink aliases. The descriptor
names the base's root, never today's configured root. The head uses the same
v8 layout at the current root. No descriptor or resource reader is constructed
for an earlier-version outcome.

At the current requested root, select the first existing manifest in the
[manifest lookup order](./mokly-generated-manifest.md#selection-cache-and-resource-addressing).
An earlier committed envelope or sentinel returns incompatibility immediately,
without inventory reads or commands. Invalid/nonregular selected files fail;
never hide them behind another filename. A valid v8 child manifest selects
blobs only when its inventory is complete. Missing manifests or incomplete v8
output select the trusted rebuild path, not a scan of other committed roots.

## Discovery After A Rebuild

After the base's own commands finish successfully and before adopting output:

1. Inspect the current requested root in the same ordered lookup. An existing
   preferred file is authoritative. Earlier output returns
   `baseline-incompatible-earlier`; malformed/nonregular/newer output or v8 at
   the flat location fails `baseline-output-invalid`. No fallback masks it.
2. If no recognized filename exists there, walk the extraction in UTF-16
   code-unit order. Exclude `.git`, `.mokly-cache` and `node_modules` at every
   depth. Never follow symlinks. Keep confined `lstat`, bounded manifest reads
   and the 65,536-entry traversal limit.
3. At each directory inspect the first existing eligible name: canonical in
   its generated child, direct canonical, then the two former sentinels. A
   valid v8 child is a compatible candidate. An earlier integer canonical
   envelope or former sentinel is an incompatible candidate, without reading
   old entries. A malformed/newer preferred file makes that directory ineligible;
   never try its older names. Do not count the generated child again as a flat
   catalogue when its manifest belongs to the parent candidate.
4. Exactly one candidate is required, whether compatible or incompatible.
   Zero or several fail `baseline-output-invalid` with
   `No unique historical catalogue after baseline build; candidates: <list>.`
   Use `(none)` for zero. Otherwise list `<root> (generated-v8)` or
   `<root> (incompatible-earlier)`, sorted by root then classification and
   joined by comma and space. Do not prefer a v8 candidate over ambiguity.
5. A sole earlier candidate returns the typed earlier-baseline outcome. Do not
   harvest it, create a current descriptor or read its resources. A sole v8
   candidate selects its historical root and must pass complete generated-file
   and byte-hash verification. Missing/stale rebuilt output fails
   `baseline-output-invalid`; a no-op recipe cannot repair a bad inventory.

A moved v8 root therefore remains usable: when the requested root is empty,
the bounded search can find the one v8 generated child elsewhere. A rebuilt
old flat catalogue may be recognized only to report incompatibility, never as
an alternative content layout. Malformed data never becomes the graceful
older-version outcome.

## Cache Identity And Readers

`inputs.json` keeps the requested/current repo-relative `mockupsDir`, not the
discovered root. New schema-1 completion markers use `manifestVersion: 8`,
`historicalCatalogueRoot` and `layout: "generated-v8"`, alongside the existing
commit, finish time and command list. Validate those fields and the v8 manifest
on reuse; do not rediscover a root during a warm hit.

Cache output is always
`output/<historicalCatalogueRoot>/mokly-generated/` plus the authored closure
under `output/<historicalCatalogueRoot>/`. Each reader accepts a pinned commit
and repository-relative path, proves that the path belongs to the generated
set or authored closure under that descriptor, and reads a confined regular
file. The Git reader uses that path directly; the cache reader appends it to
`output/`. No reader strips a legacy root to access flat output.

The [storage compatibility probe](./mokly-baseline-storage.md#cache-layout)
can inspect a previous completion marker and old manifest envelope solely to
return `baseline-incompatible-earlier`. It cannot return a content reader,
convert entries, relabel a v6 cache as v8 or reuse an old closure. Request/recipe
mismatches retain the existing fail-intact/remove-entry guidance.

## Comparison Namespaces

Both accepted sides use v8 kind/id and view-axis addressing. Pair documents
by that identity, with generated paths derived by the shared route helpers;
read them beneath each side's own generated root. Generated stylesheet/asset
keys are generated-relative; authored resource keys are catalogue-relative.
These are separate namespaces even if their trailing strings are equal.

Resolve local HTML/CSS URLs against each referring file in its own root and
retain normal query/fragment, encoding, security and resource-membership rules.
A root move alone leaves these layout-relative addresses unchanged. Do not
normalize v2–v7 document hrefs into v8 ones, rewrite paired HTML to accommodate
an older layout, or use Git changed-path strings to locate a base resource.
Git paths remain source/dependency evidence only. Existing ordinary resource
resolution, materiality and CSS equivalence checks remain required.

Classification, selected comparisons, removed previews, component fast paths,
CSS attribution and export/publication capture consume this same v8 descriptor.
Snapshot publication retains its generation-local URLs; these are not a second
baseline storage layout. Earlier output supplies no snapshot or removed entry.
