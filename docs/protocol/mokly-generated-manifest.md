# Generated Manifest And Historical Readers

## Delivery Status

This branch implements v6, documented below. The v8 sections are the approved
Milestone 11 target in
[Generated Output Simplification](../../plans/generated-output-simplification.md).
They replace v6 as the current writer and merge `main`'s v7 identity model.
Historical versions retain separate readers; they never become current input.
See [unified output](./mokly-unified-output.md) for paths and imported CSS.

## Manifest V6 And Per-Commit Baselines

The current canonical manifest has `schemaVersion: 6`, retains v5 fields and
adds:

```ts
assetClosure: string[]; // sorted, unique catalogue-relative POSIX file paths
generatedFiles: { path: string; blobHash: string }[]; // sorted by path
blobHashAlgorithm: "sha1" | "sha256";
```

`generatedFiles` inventories **every generated file except the manifest
itself**; a manifest cannot contain its own Git blob hash without a circular
dependency. The manifest's presence and schema are checked separately. Each
`path` is relative to `mokly-generated/`, never a closure file; generated HTML and
fragments are included. `blobHash` is the lowercase hex digest of
`<algorithm>(UTF8("blob " + byteLength) || 0x00 || exact UTF-8 file bytes)`;
choose the repository's Git object format (`git rev-parse --show-object-format`),
defaulting to `sha1` without Git. Require 40 hex digits for SHA-1 or 64 for
SHA-256. This is Git's blob-object ID, **not** a digest of the path or rendered
string. Validate uniqueness, sorting, safe confinement, algorithm and format
at parse time. The resulting serialized manifest has canonical deterministic
ordering. Readers of v2 (only with the existing compatibility switch), v3,
both disjoint v4 forms, and v5 continue to work for historical comparisons;
current live output requires v6.

For **each pinned merge-base commit**, inspect its tree once with `git ls-tree`
and look first for `<current repo-relative mockupsDir>/mokly-generated/mokly-manifest.json`,
then for `<current repo-relative mockupsDir>/mokly-manifest.json`. When the
canonical path is absent, historical `mokabook-manifest.json` and the opt-in
v2 `mockbook-manifest.json` fallback remain at the legacy root; never override
an existing but invalid canonical manifest with an older name. No manifest
at those locations means **rebuild** using the base commit's own configured
install/build recipe. A moved `mockupsDir` also rebuilds when the current root
has no manifest. Deterministic discovery of the historical root and its cache
descriptor is specified in [baseline addressing](./mokly-baseline-addressing.md).

For v6, compare the tree's regular blob paths **exactly** with
`generatedFiles` plus the manifest path, comparing each blob ID with its
inventory hash. Missing, extra, non-regular, or mismatched blobs mean
**rebuild** with an informational diagnostic before running the recipe.
For v5 and earlier, retain the historical rule that a committed manifest is
assumed complete and read its Git blobs; no inventory is fabricated for it.
If the manifest is malformed, report `manifest-invalid` rather than silently
trusting it. A Git read failure is not evidence of absent output. The head
side of a comparison always uses validated, in-memory compilation; it never
requires working-tree output to match. Baseline reader selection is per
commit, never based on the head tracking state.

Emit the following **info-level stderr diagnostic** only when inventory
verification requests a rebuild (for normal CLI, watched Serve parent, and
export/publication comparison preparation), with sorted generated-root-relative
paths, using the first applicable reason in missing, mismatched, extra order
(a non-regular path is missing for this purpose):

```text
Mokly baseline <commit>: rebuilding because generated output is missing: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has mismatched blob hashes: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has extra files: <comma-separated paths>.
```

No-manifest rebuilds need no inventory diagnostic. Do not log secrets or
expose these diagnostics in the Browse shell. Baseline rebuilds execute trusted
historical code only; `review.baselineBuild` remains available regardless of
head tracking. See [baseline selection](./mokly-derived-baselines.md).

## Approved Manifest V8

Emit `schemaVersion: 8` for every newly compiled catalogue. Retain `main`'s
v7 entry shapes, validation, ordering and identity-derived routes unchanged;
add this branch's closure and inventory fields to that envelope:

```ts
interface ManifestV8 {
  schemaVersion: 8;
  generatedBy: "mokly";
  entries: readonly ManifestEntryV7[];
  sourceFiles: readonly string[];
  assetClosure: readonly string[];
  generatedFiles: readonly { path: string; blobHash: string }[];
  blobHashAlgorithm: "sha1" | "sha256";
}
```

`ManifestEntryV7` means the complete merged entry contract from `main`, not a
new runtime import name: required `navPath`, `declaredDependencies`, effective
schemes, ordinary screen/component variant entries with `variantOf`, and all
existing usage, props, controls, ownership and relationship checks. Components
have no parent views. Preserve authored variant order after each parent and
kind/id ordering elsewhere. Store no entry `route`, fragment/view path,
derived dependency union, or nested component `variants` array.

`sourceFiles` keeps the full private source inventory, including imported CSS,
assets and PostCSS dependencies. `assetClosure` lists only public authored
files under the catalogue root; no generated path or imported private source
belongs in it. The generated inventory includes every HTML file, compiled
stylesheet and copied binary asset, but not the manifest. Its paths are
relative to the generated root: `styles/...` and `assets/...`, not
`mokly-generated/styles/...`. An inventory is necessary evidence of actual
files and their bytes, not a redundant per-entry route field.

Hash raw file bytes with Git's blob header and repository object algorithm.
UTF-8 encode text once; never decode/re-encode binary assets. Validate inventory
uniqueness, UTF-16 code-unit ordering, path confinement, file/directory and
case-folded collisions, supported path kind and hash length. Require the actual
compiled file set, not just HTML routes, to match the inventory before emitting
the manifest. Source/closure paths and inventory entries use code-unit order;
JSON keys, required empties and optional omissions retain `main`'s canonical
two-space/final-LF serialization. No unknown fields are accepted.

## Historical Readers And Layouts

The current/live private manifest boundary accepts only v8. Keep all supported
historical formats through explicit dispatch, without guessing a version from
field presence or silently interpreting an old manifest as v8:

| Schema             | Historical reader and storage                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 2                  | Existing opt-in `compatibility.readManifestV2`, legacy fallback filename and flat layout                                |
| 3                  | Existing historical reader and flat layout                                                                              |
| 4, pages form      | Existing `sourceFiles`/pages shape; disjoint from component v4                                                          |
| 4, components form | Existing `legacyPages`/components shape; reject a mixed envelope                                                        |
| 5                  | Existing reader, explicit routes and flat catalogue                                                                     |
| 6                  | This branch's explicit routes, generated tree, closure and verified blob inventory                                      |
| 7                  | `main`'s identity-derived entries; manifest/pages at catalogue root; CSS/assets below its generated child; no inventory |
| 8                  | Identity-derived entries, unified generated tree, closure and verified blob inventory                                   |

There is no v1 reader. Preserve the existing v2 switch, filename precedence and
malformed-selected-file failures. The change intentionally replaces `main`'s
blanket pre-v7 unavailable outcome with supported historical readers, as required
by decision 28. Invalid/unknown versions still fail the historical boundary;
never convert an invalid manifest into absent history or an empty comparison.

Normalize each accepted version into a typed historical catalogue, retaining
its own document/resource addresses separately from current v8 entries.
For old screens and pages, pair by kind/id; pair rendered views by that entry
identity plus viewport and scheme. Read old bytes at stored legacy routes,
never at a route newly derived from the current id. Convert legacy collection
ancestry into folder labels for historical `navPath`; collections themselves
have no current entry or invented preview. Preserve original sibling order
and source metadata in the historical descriptor.

Older nested component variants remain addressed by `(component id, saved
variant id)` in the historical model. They are not promoted to guessed global
ids. Pair one with a current component-variant entry only when its parent id
and saved id exactly match the current `variantOf` and global `id`; otherwise
retain added/removed evidence. Do not combine or prefix ids to guess author
intent. Ambiguous old ids remain scoped to their parent. Historical preview
metadata must retain that scope and must not create colliding public current
entries. If an older catalogue cannot be projected without colliding or
inventing global variant ids, retain `main`'s comparison-unavailable outcome:
Serve stays usable; export/publication succeed with no historical files,
`changesStatus: "unavailable"` and `comparisonUrl: null`. Print once per pinned
base: `Changes are unavailable because the comparison base uses component variant identities that this version cannot represent. Rebuild the base with this Mokly version.`
This exception is about lossless identity projection, not manifest age; valid
v2–v7 manifests must still parse and otherwise compare normally. Test both
representable and colliding legacy variant ids. Missing older usage stays
unavailable, never ready-empty. Preserve each version's absent-metadata rules.

## Selection, Cache And Resource Addressing

Apply the existing ordered current-root lookup and post-build discovery, with
v6 or v8 accepted in the generated child and v2–v5 or v7 at a legacy root.
Do not mistake v7's CSS-only `mokly-generated/` directory for a second
catalogue: it has no manifest. Version and selected location must agree; reject
a v7 manifest placed in the v8 child, or a v8 manifest at the old flat root.

Verify v6 and v8 Git inventories against the complete generated subtree plus
the separately parsed manifest. Missing, mismatched, extra or nonregular blobs
rebuild that pinned commit with the existing diagnostic above. V2–v5 and v7
have no inventory: a committed valid manifest selects Git blobs under their
historical completeness assumption, with normal missing-resource errors on
use. A missing manifest selects the commit's own build recipe. No head index,
head build policy or source recompilation with the current package selects it.

Keep `BaselineCatalogue.layout: "generated-v6" | "legacy"`. The former names
the physical generated-child layout and now covers v6 and v8, not an exclusive
schema version. `manifestVersion` in the completion marker disambiguates the
reader. Its historical catalogue root stays pinned; a moved current root does
not rewrite base paths. Keep completion marker schema 1 and extend its validated
manifest-version set to 7 and 8. Do not discard valid existing v6 caches.

For v8, harvest the whole generated subtree, including CSS and opaque assets,
and exactly the authored closure beside it, as for v6. Validate the built
inventory before adoption. V7 retains the legacy flat harvest, including its
generated CSS subtree. Pre-descriptor cache markers are still accepted only
for v2–v5 with their existing flat/requested-root restriction; do not assign
them an invented v7 or v8 layout. Keep lock, cancellation, alias confinement,
limits, retention and marker-commit behavior unchanged.

Resource comparison keys are typed as generated resource versus authored
closure. For CSS/assets, remove each side's physical generated prefix once:
v7 `<baseRoot>/mokly-generated/styles/a.css` and v8
`<headRoot>/mokly-generated/styles/a.css` both key as generated `styles/a.css`.
An authored `<catalogueRoot>/styles/a.css` is a different key. Resolve URLs
against each side's actual referring file before normalization; preserve
query and fragment. Document pairing uses identity/axes as above, while each
reader uses its retained address. Never use a head path or Git changed-path
string to locate a baseline resource.

Update all consumers: registry parsing, baseline selection/build/discovery,
cache reuse, committed and rebuilt readers, Review, component fast paths,
CSS attribution, removed previews, Serve, export, repository preview and
publication capture. Public JSON remains an allowlist projection; do not leak
`sourceFiles`, `assetClosure`, blob hashes, or the private manifest itself.
Test every historical form, both root layouts, v7-to-v8 transitions, moved
roots, both blob algorithms and binary resources. An unsupported version must
fail before any route, inventory or cache-path interpretation.
