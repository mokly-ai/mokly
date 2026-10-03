# Generated Manifest And Baseline Version Gate

## Delivery Status

Approved Milestone 11 target in
[Generated Output Simplification](../../plans/generated-output-simplification.md).
The branch still emits v6 until that implementation lands. Correction 3 option A
supersedes the earlier multi-version-reader design: only v8 is readable as a
current or baseline catalogue. Preserve `main`'s earlier-version outcome with
its threshold raised to v8. This documentation update changes no reader code.
During the merge, reconcile `main`'s `mokly-baseline-compatibility.md` with this
gate and add its link only after that document is present.

## Approved Manifest V8

Emit this envelope for every newly compiled catalogue:

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

`ManifestEntryV7` names `main`'s identity-only entry contract, not a required
runtime type name. Preserve `navPath`, `declaredDependencies`, effective schemes,
ordinary screen/component variant entries with `variantOf`, and all usage,
props, controls, ownership and relationship checks. Component parents have no
views. Keep authored variants immediately after their parent and kind/id order
elsewhere. Store no entry route, fragment/view path, derived dependency union
or nested component `variants` array. Paths derive from kind/id and view axes
under [generated delivery](./mokly-generated-delivery.md).

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
and final LF. Current and baseline v8 use the same full validator; unknown
fields remain invalid.

## Historical Readers And Layouts

There is one readable schema and one content layout: v8 under
`<catalogueRoot>/mokly-generated/mokly-manifest.json`. Detecting an older
version is an envelope check, not a reader for that schema's entries or files.

A canonical JSON object with an integer `schemaVersion` below 8 yields
`baseline-incompatible-earlier`, including every v2–v7 form and this branch's
v6. Do not validate or translate its old entry fields, inspect its inventory,
read its documents, or retry it through another filename. The former
`mokabook-manifest.json` and `mockbook-manifest.json` names are earlier-output
sentinels when no preferred canonical file exists; do not parse their contents.
Remove the old v2 compatibility switch and readers as `main` already did.

A version above 8, invalid JSON, a non-object root, missing/non-integer version,
malformed v8 data, nonregular selected file, or misplaced v8 manifest follows
the existing invalid-baseline path. None becomes the earlier-version outcome
or a successful empty comparison. Source confinement and bounded reads apply
before version classification. Git I/O errors are not evidence of absence.

## Selection, Cache And Resource Addressing

Pin the merge-base commit, then inspect its tree at the requested current
catalogue root in this exact precedence:

1. `mokly-generated/mokly-manifest.json`;
2. `mokly-manifest.json` at that root;
3. `mokabook-manifest.json`, then `mockbook-manifest.json` at that root.

The first existing file wins. A committed earlier canonical envelope or former
sentinel decides `baseline-incompatible-earlier` **without a rebuild**, even
if an old inventory is incomplete or a cache contains different output. A
selected invalid file fails without fallback. A v8 file is valid only at the
first location; validate its full schema before checking generated blobs.

For v8, compare the commit's generated subtree exactly with `generatedFiles`
plus the manifest. Missing, nonregular, mismatched or extra blobs select a
rebuild using that commit's own recipe. A complete inventory selects Git blobs.
If every known manifest location is absent, select a rebuild; do not search
other Git-tree roots to avoid it. Thus a moved catalogue root can require a
rebuild even when the commit stored a manifest elsewhere. Neither selection
nor comparison reads the head Git index or requires current disk output.

Inventory-triggered rebuilds keep these info-level stderr diagnostics, with
sorted generated-relative paths and the first reason in the listed order:

```text
Mokly baseline <commit>: rebuilding because generated output is missing: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has mismatched blob hashes: <comma-separated paths>.
Mokly baseline <commit>: rebuilding because generated output has extra files: <comma-separated paths>.
```

A no-manifest rebuild needs no inventory diagnostic. The historical recipe uses
its own source, lockfile and tooling; never rebuild old sources through today's
Mokly package just to force an upgrade. After success, apply the same version
gate to the selected output. If that build wrote an earlier manifest, decide
`baseline-incompatible-earlier` **after the rebuild**, with no old-content
harvest, reader or comparison. The exact moved-root search and ambiguity rules
are in [baseline addressing](./mokly-baseline-addressing.md).

A previously completed cache holding an older manifest can also prove the
incompatible outcome without commands. It is never a readable baseline. The
[storage contract](./mokly-baseline-storage.md#cache-layout) defines the bounded
compatibility probe, identity checks, retention and fresh-build cleanup.

## Earlier-Baseline Outcome

Retain `main`'s typed `baseline-incompatible-earlier` handling:

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

## Kept And Removed Machinery

Keep per-commit blob/rebuild selection, v8 blob inventory verification, trusted
recipe execution, bounded moved-root discovery, root-specific descriptors,
cache locks/cleanup, and generated-versus-authored resource addressing. Both
comparison sides are v8: pair by kind/id and view axes, resolve resources using
each side's actual catalogue root, and compare closure membership and bytes.
A moved root does not authorize reading under today's root on the base side.

Remove this branch's pre-v8 content readers, legacy flat-layout reader/harvest,
old-schema adapters and cross-layout HTML URL normalization. Do not retain a
`generated-v6 | legacy` reader union or old-publication fallback. Keep the
ordinary URL parser, encoding/confinement checks, CSS resource analysis and
mainline equivalence rules; they are not cross-layout compatibility. Preserve
every deletion already on `main`; this decision does not resurrect its removed
formats, APIs, fixtures or tests.

Acceptance must cover committed v2–v7 envelopes without a build, earlier output
found after a real rebuild, existing older caches, complete/incomplete v8
inventories, moved v8 roots, malformed/newer data, both blob algorithms and
binary resources. Prove each command's earlier-baseline behavior, the once-per-
base diagnostic and recovery after a v8 base arrives. A v7-to-v8 content
comparison is no longer an accepted operation.
