# Historical Catalogue Discovery And Addressing

## Delivery Status

Implemented for v6 and historical baselines in [Generated Output Simplification](../../plans/generated-output-simplification.md).
This supplements [per-commit selection](./mokly-derived-baselines.md) and
[baseline storage](./mokly-baseline-storage.md). It does not inspect the head
Git index: only `check` uses index tracking.

## Per-Commit Descriptor

Each pinned baseline selection supplies an immutable descriptor to both Git
blob and rebuilt readers:

```ts
interface BaselineCatalogue {
  commit: string; // pinned merge-base commit
  layout: "generated-v6" | "legacy";
  catalogueRoot: string; // repository-relative POSIX historical mockupsDir
  generatedRoot: string; // `${catalogueRoot}/.generated` for v6, else catalogueRoot
}
```

Normalize a repository-root catalogue to `.`; join paths without writing
`./` into Git requests. All roots must be confined, regular directories,
without symlink aliases. The descriptor describes the **base**, never today's
config. The head descriptor is always the current `mockupsDir` with
`generatedRoot = <mockupsDir>/.generated` and the v6 layout.

For a commit with a manifest at the current root, prefer
`<current mockupsDir>/.generated/mokly-manifest.json` as v6, then the
historical single-directory canonical manifest, then its former name and
opt-in v2 name. Malformed or non-regular selected manifests fail; never use
an older filename to hide an invalid preferred manifest. A missing manifest
at those locations selects a rebuild, **not** a search of Git history for an
older root. Complete v6 inventory selects Git blobs; an incomplete inventory
rebuilds as specified in [generated output](./mokly-generated-output.md#manifest-v6-and-per-commit-baselines).

## Discovery After A Rebuild

After all historical build commands succeed, discover the generated root
inside the extracted commit, before harvesting or writing the cache marker:

1. If the current requested catalogue root contains
   `.generated/mokly-manifest.json`, validate it as v6 and select that root.
   Existence with invalid bytes, type, or symlink fails
   `baseline-output-invalid`, not fallback.
2. Otherwise try a direct legacy manifest at the current root in canonical,
   former, then opt-in v2 filename order. The first existing name must parse
   as the corresponding historical schema; an invalid one fails
   `baseline-output-invalid`, not fallback.
3. Otherwise walk the extraction lexicographically, excluding every `.git`,
   `.mokly-cache`, and `node_modules` directory at any depth; never follow
   symlinks. Use confined `lstat`, the existing bounded manifest reader, and
   at most the 65,536-entry extraction traversal bound. For each directory,
   inspect the first existing eligible manifest in order: v6 `.generated/`
   child, then direct canonical, former and opted-in v2 names. A `.generated/`
   directory holding its parent's v6 manifest is not a second legacy root.
   If that preferred manifest is malformed, skip the directory entirely;
   do not use an older filename to hide it. Only directories with a valid
   selected manifest are candidates. A malformed manifest at the explicitly
   requested root still fails steps 1–2.
4. Exactly one candidate selects its repository-relative root and layout.
   Zero or several fail `baseline-output-invalid` with
   `No unique historical catalogue after baseline build; candidates: <list>.`
   Use `(none)` for zero; otherwise list `<root> (<layout>)` entries sorted by
   root and then layout, comma-separated. Do not guess from today's config.
5. For a selected v6 candidate, verify the built tree's generated files and
   Git blob hashes against its inventory (from built file bytes, not the
   head index). Incomplete or stale rebuilt output fails
   `baseline-output-invalid`; a no-op recipe cannot turn an invalid
   committed inventory into a valid cached baseline.

For example, the migrated example requests `examples/basic` but a legacy
`origin/main` build produces `examples/basic/generated/mokly-manifest.json`;
the scan selects `examples/basic/generated` as `legacy` when the requested
root has no manifest. The recipe's historical code remains trusted input.

## Cache Identity And Readers

Keep `inputs.json` as the JSON string of the **requested/current**
repository-relative `mockupsDir` (`"."` for a repository-root catalogue),
not the discovered root. A mismatch with
the request, or a different command list in the completion marker, fails
intact with the existing remove-the-entry guidance. New `complete.json`
schema-version-1 markers retain `commit`, `finishedAt`, `commands`, and
`manifestVersion` and add `historicalCatalogueRoot` (the discovered
repository-relative POSIX path) and `layout` (`generated-v6` or `legacy`).
Validate these fields and the corresponding harvested manifest on reuse;
derive `generatedRoot` from them, never rerun discovery on a warm cache hit.

New v6 cache entries store generated files beneath
`output/<historicalCatalogueRoot>/.generated/` and the manifest's authored
closure beneath `output/<historicalCatalogueRoot>/`. Legacy entries retain
the existing flat `output/<route>` tree. Both readers accept `(commit,
repositoryRelativePath)`, verify that the path is under the descriptor's
generated or catalogue root and is an allowed generated document or closure
resource, then read only a confined regular file. The Git reader uses the
repository-relative path directly; the v6 cache reader appends it to `output/`;
the legacy cache reader strips **historicalCatalogueRoot** before reading
under flat `output/`. Neither uses today's root to translate a base path.

Pre-v6 completed cache markers lack the new fields. Accept them only with
manifest versions 2–5 and the existing flat `output/` layout; their historical
root equals the requested root stored in `inputs.json`, as the old builder
could not discover another root. Validate the legacy manifest on reuse.
If `inputs.json` differs after a catalogue move, fail intact and require
removing that cache entry before retrying. A v6 marker missing the new fields
is incomplete and rebuilt under the lock.

## Comparison Namespaces

Never pair documents by repository-relative filename. Identify each side's
generated document by its manifest **route relative to that side's
`generatedRoot`**: head `<currentRoot>/.generated/<route>` pairs with base
`<baseRoot>/.generated/<route>` for v6 or `<legacyRoot>/<route>` for legacy.
Resolve each local HTML/CSS URL against the referring document or CSS file in
that side's actual layout, then key the authored resource by its path relative
to that side's `catalogueRoot`; thus head `../styles.css` and legacy base
`styles.css` can pair as `styles.css`. Traverse each side's referenced closure
independently; membership and exact bytes still decide materiality.
For paired document materiality, normalize each local `href`, `src`, `srcset`
candidate, and inline-style `url()` against its own side's real document path
before comparing. Replace the URL's path with its catalogue-relative resource
key (or logical generated route for a generated-document link), preserving
query and fragment. Thus v6 `../styles.css` and legacy `styles.css` compare
equal without hiding a changed stylesheet or a missing resource. Apply the
same paired normalization in the unchanged-view fast path; raw HTML bytes
are not a cross-layout materiality signal.

Classification, selected comparisons, removed-content previews, component
resource attribution, the unchanged-view fast path, CSS change attribution,
and export/publication capture all use these side-specific namespaces and
the descriptor for reads. Git changed-path evidence stays repository-relative
for dependency/source impact and is **never** used to translate catalogue
roots or infer a resource's comparison key. Snapshot publication retains
its existing generation-local public URLs after comparison.
