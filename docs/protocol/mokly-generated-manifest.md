# Generated Manifest And Baseline Version Gate

## Delivery Status

Current and baseline readers accept only v9. The
[baseline compatibility contract](./mokly-baseline-compatibility.md) defines the
earlier-version outcome and exact product copy. Implementation and verification
are tracked by [Generated Output Simplification](../../plans/generated-output-simplification.md).

## Current Manifest V9

Emit this envelope for every newly compiled catalogue:

```ts
interface ManifestV9 {
  schemaVersion: 9;
  generatedBy: "mokly";
  entries: readonly ManifestEntry[];
  folders: readonly ManifestFolder[];
  sourceFiles: readonly string[];
  assetClosure: readonly string[];
  generatedFiles: readonly { path: string; blobHash: string }[];
  blobHashAlgorithm: "sha1" | "sha256";
}
```

`ManifestEntry` uses the path-based [entry and folder schema](./mokly-component-manifest.md).
Preserve `declaredDependencies`, Markdown resource paths, effective schemes,
screen/component variants with `variantOf`, and all usage, prop, control and
relationship checks. Component parents have no views. Keep authored variants
immediately after their parent and kind/path order elsewhere. Store no route,
view file name, derived dependency union or nested component `variants` array.
The shared helpers derive file names under
[generated delivery](./mokly-generated-delivery.md).

`sourceFiles` remains the full private inventory, including imported CSS,
assets and PostCSS dependencies. `assetClosure` is the sorted unique list of
public authored catalogue-relative files; no generated or private input path
belongs in it. `generatedFiles` inventories every generated HTML file, compiled
stylesheet and opaque asset, except the manifest itself. Its paths are relative
to `mokly-generated/`: `styles/...`, not `mokly-generated/styles/...`.
The inventory proves actual files and bytes; it does not restore entry routes.

Hash exact bytes with Git's blob header:
`<algorithm>(UTF8("blob " + byteLength) || 0x00 || bytes)`.
UTF-8 encode text once; never decode/re-encode assets. Choose the repository's
Git object format, defaulting to SHA-1 without Git. Require lowercase hex with
40 digits for SHA-1 or 64 for SHA-256. The manifest cannot contain its own hash;
validate its presence and schema separately.

Validate uniqueness, UTF-16 code-unit ordering, safe paths, supported output
kinds, file/directory and case-folded collisions, and hash format. Before
emission, require the compiled set to equal the inventory plus the manifest.
Source/closure paths and inventory entries use code-unit order. Keep canonical
object-key ordering, required empties, optional omissions, two-space indentation
and final LF. Current and baseline v9 use the same full validator; unknown
fields remain invalid.

## Historical Readers And Layouts

The only content layout is v9 at
`<catalogueRoot>/mokly-generated/mokly-manifest.json`. Mokly recognizes only
the canonical `mokly-manifest.json` name. It has no other-name sentinels,
old entry readers, layout conversion or old cache readers.

## Selection, Cache And Resource Addressing

Pin the merge-base commit and derive the requested repository-relative
`<catalogueRoot>/mokly-generated/` prefix. List only that generated subtree
with a literal Git pathspec, retaining repository-relative paths. Never list
the whole commit to choose a baseline. Probe only the canonical manifest
inside this subtree. A committed root-level manifest, including stale v7,
has no effect on selection.

If the selected manifest is absent, rebuild with that commit's own recipe.
A regular manifest below v9 in the current generated location retains the
typed earlier-version outcome. Invalid JSON, non-object data, missing or
non-integer versions, newer versions and nonregular selected files remain
invalid; do not treat I/O errors as absence. Validate v9 fully before its
inventory. Complete matching v9 blobs select the Git reader. Missing,
nonregular, mismatched or extra inventory files select a rebuild.

Keep these inventory diagnostics, with sorted generated-relative paths and
the first reason in the order below:

```text
Mokly baseline <commit>: rebuilding because generated output is missing: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has mismatched blob hashes: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has extra files: <comma-separated paths>.
```

A missing-manifest rebuild needs no inventory diagnostic. Rebuilds use the
pinned commit's own source, lockfile, dependencies, configuration and tooling.
Do not inject today's Mokly package into historical source.

After the commands succeed, discover output under
[baseline addressing](./mokly-baseline-addressing.md). Prefer the canonical
manifest in the generated child. Only after a rebuild, a canonical manifest
below v9 at `<catalogueRoot>/mokly-manifest.json` proves the earlier-version
outcome. Do not harvest it or cache the outcome. This check prevents an old
build from being mistaken for current output without restoring a flat reader.
A v9 manifest at the flat location is invalid.

A cache entry is reusable only when it is complete, valid v9 output for the
requested commit, catalogue and recipe. Empty, truncated, earlier-format,
unreadable or incomplete entries are partial. The builder removes only those
partial entries under its lock and rebuilds. It never uses them as
incompatibility evidence. A valid v9 marker with different requested catalogue
or build settings fails intact before output validation.
[Storage](./mokly-baseline-storage.md#cache-layout) defines validation,
safe cleanup and atomic marker publication.

## Earlier-Baseline Outcome

Retain typed `baseline-incompatible-earlier` handling:

| Command                     | Required result                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Serve                       | Keep All usable; set `changesStatus: "unavailable"`; expose no changed/removed entries, comparison or previous-version data.           |
| Export                      | Succeed with current content, `changesStatus: "unavailable"`, `comparisonUrl: null`, and no comparison generation or historical files. |
| Publication with Changes    | Succeed with the same current-only unavailable result.                                                                                 |
| Publication without Changes | Remain `disabled` and perform no baseline work.                                                                                        |

Serve, export and Changes-enabled publication print this exact product line
once when rejecting the pinned base:

```text
Changes are unavailable because the comparison base was built with an earlier version of Mokly. Changes will return once the base includes this version.
```

Watched Serve retains that outcome for the pinned commit and build settings;
content updates do not rebuild it or repeat the line. A changed base follows
normal preparation and can restore Changes without restarting Serve. Use the
typed error code, never message matching. Invalid/newer manifests retain normal
safe diagnostics in Serve and failure for explicit comparison captures.

## Reader And Verification Boundary

Keep per-commit blob/rebuild selection, exact v9 inventory verification,
bounded moved-root discovery, descriptors, locks, cleanup and source privacy.
Both comparison sides use v9. Pair by kind/path and view axes, then resolve
generated and authored resources under each side's own historical root.
Resource membership and exact bytes are compared on every path; no mode flag
can disable byte comparison.

Tests cover committed stale root-level v7 with a successful v9 rebuild,
earlier root-level output produced by the base's own rebuild, partial cache
rebuilds and atomic marker publication. Preserve invalid/newer manifest
rejections, confinement, inventory validation and the command outcomes above.

The approved [path/output integration](./mokly-path-output-integration.md)
defines the current path-derived layout. Its
[format inventory](./mokly-format-versions.md) defines manifest v9, catalogue v5,
review v6 and all other boundaries. Only v9 baseline content is readable after
that integration; the earlier-version product outcome remains unchanged.
