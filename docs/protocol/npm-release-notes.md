# npm Release Notes

## Delivery Status

### Unreleased Breaking-Change Coverage

The squash-merge commit uses `!` and `BREAKING CHANGE:` footers for the
contracts below. Release Please owns package versions and changelogs. The
[public API report target](./verification-api-members.md#public-api-reports) covers
all typed package entry points and the non-code export inventory. Any report
change relative to `origin/main` requires a release-note change in that diff.
The existing released-export-name check remains independent.

- `fcae6390 feat!: complete source-path evidence removal` — combined below.
- `e5407723 feat!: remove authoring dependencies` — combined below.
- `43404882 feat!: derive entry identity from paths` — the path identity note
  below.
- `b39d89a4 feat!: simplify generated output and delivery` — generated output,
  removed options, current-only formats and the portable namespace below.

## Generated Output And Manifest API

`MoklyConfig` no longer accepts `generatedOutput` or `publicExclude`.
`mockupsDir` names the authored catalogue root, and all generated files live in
its `mokly-generated/` child. Only Build, `build --watch` and `serve --build`
write that tree. Plain Serve, export and publish compile in memory. Check uses
Git-index tracking to choose its tracked or untracked validation boundary.
Remove the old options; no default-output mode replaces them.

`ManifestV9` replaces the incompatible pre-merge `ManifestV8` shapes. The `Manifest` and `HistoricalManifest`
aliases now name v9. V9 requires `assetClosure`, `generatedFiles` and
`blobHashAlgorithm` in addition to the identity-only entries and source
inventory. Regenerate this data with Build; do not hand-convert old manifests.
Only the complete combined v9 shape is readable as baseline content. Former
manifest filenames no longer act as sentinels. Missing canonical output uses
normal absence and rebuild selection. Earlier-version detection returns the
existing unavailable outcome, which is never cached.

## Removed Public Options And Types

The current API has no document transformation bridge. Remove
`MoklyConfig.compatibility` and `compatibility.transformer`. The
`CompatibilityConfig`, `CompatibilityTransformer` and
`CompatibilityTransformInput` exports are removed from `@mokly/mokly`.
Render portable HTML and links directly in entries or the configured renderer.
Supplying `compatibility`, including `undefined`, fails with
`compatibility was removed; author portable links directly`.

Catalogue v5 has one fixed layout. The branch-only `generatedPathPrefix`,
`GeneratedPathPrefix`, `FrameMount.generatedPathPrefix` and `FrameMount.route`
never shipped and have no migration API. `currentDocumentPath(route)` and
`currentDocumentRoute(pathname)` use `GENERATED_DIRECTORY` directly. The
catalogue schema version is 5. No DOM prefix override is supported.

Export directories require the current v3 ownership marker or must be empty.
There is no preview-marker migration. Baseline caches accept only complete v9
output and rebuild invalid entries. Only the current generated notice is
nonmaterial; its LF and CRLF forms remain accepted. Format version rejection,
removed-key errors and the service's 426 handling remain unchanged.

Stored `BrowseRecoveryState` requires `changesStatus` and
`filterBaselineDisclosures`; missing values discard that stored snapshot.
General shell snapshots keep their optional live status. Removed records require
`snapshotId` for any non-null `comparisonUrl`. Serve's local comparison endpoint
is not a public catalogue pointer; published pointers retain the generation-only
allowlist.

## Breaking Portable Namespace Release Note

The viewer namespace is now `mokly-viewer/`, with comparison generations below
`mokly-viewer/diffs/generations/`. There is no `/__mokly/` alias. Generated HTML,
CSS, assets and the private manifest share `<mockupsDir>/mokly-generated/`.
Exported current resources live under `static/mokly-generated/`, with authored
closure files beside that child under `static/`.

Readers accept source manifest v9, public catalogue v5, delivery v5 and
bootstrap v2 only. The namespace change advances ownership to v3 and upload to
v2 while retaining Plan v1 and content deltas. These supersede the intermediate
format numbers in the earlier upgrade notes below. An older receiver returns
426 with the documented service-version message; an incompatible viewer fails
before reading paths. Mokly Cloud requires the separate receiver/viewer update.
See [namespace compatibility](./mokly-viewer-namespace.md#compatibility-failure).

The historical notes retain coverage for earlier releases: `7aba5ec2`
(navigation paths), `d227702e` (identity), `40ab4324` (comparison baseline),
`c16926ba` (baseline and viewer host), and `52ca8548` (delta publishing).
They describe earlier upgrades, not the current API. The path identity note
supersedes their identity, navigation and format guidance.

## Breaking Path Identity Release Note

The path identity upgrade removes `id`, `navPath`, `entries`, and `entriesDir`.
The removed nested authoring types include `NestedFolderInput` and `RootInput`.
Each entry has one path derived from its discovered exporting file. It adds Markdown
documents and move detection, renames Pages to Specs, and gives each entry a
generated directory. Consumers must adopt manifest v9, catalogue read model
v5, review result v6, disclosure storage v4, and `/view/<path>/` URLs.

Earlier formats, URLs, ids, disclosure keys, and configuration are not read or
translated. There is no compatibility reader, URL redirect, id mapping,
storage-key conversion, configuration fallback, or migration tool. Former
configuration fields fail as unknown fields, except the removed
`review.sharedImpact` input, which warns and has no effect. An earlier comparison base makes
Changes unavailable until it includes this version. Migration is manual;
regenerate the catalogue after changing authoring and update saved entry links.

Generated HTML has one plain notice, which proves no ownership. The complete
`mokly-generated/` tree belongs to Mokly; authored assets stay outside it.
Preview builds do not adopt `.mokly-preview-artifact` output. Preserve authored
files, delete an old export destination, and export again. Do not rename headers
or markers to claim ownership. Current export ownership uses schema 3.

This release also removes source-path evidence. Delete entry `dependencies`,
removed component `ownedDependencies` and `review.sharedImpact`. Current authoring
helpers warn once when these keys are present and ignore their values. Public
input types use `?: never` for removed authoring fields; explicit `undefined`
needs `exactOptionalPropertyTypes` for a type error. Strict commands count these warnings before any output write or upload.
Declare separately authored component CSS with `stylesheets` and place it with `componentStylesheets` when
needed. The shared public-file policy refuses symbolic links at every public path
component, including declared CSS and renderer links. Remove public stylesheet
aliases and use regular files. Only configured links anchor component CSS
placement. Reused renderer links
receive no inserted provenance. The renderer keeps its configured and generated
CSS list. Ordinary package edits finalize private full-link spans; no transformer
or transient token remains.

Changes uses rendered output, reachable resources, reviewable metadata and
component usage. All CSS delivery paths use the same changed-rule test: kept
own-page matches change a component; outside matches and unresolved rules give
the page a direct row. Source-only edits add no evidence. Details omit the
source dependency list. The combined current formats carry both changes without another version:
manifest v9 includes root ranges and `insertedStylesheets` with
`componentPaths`; catalogue v5 carries view/page `resourceEvidence`; review v6
carries `ruleKey`, `changedComponentPaths`, `pageSelectors` and `pageEvidence`.
Manifest dependency declarations, catalogue `details.dependencies`, review
`sharedImpact` and entry dependency lists are absent. Earlier shapes are not
read. Rebuild baselines and regenerate public exports. Former `mokabook-`
component and Review-ignore comments are ordinary content, with no translation.

Migrate authoring as follows:

- Replace `entries` and `entriesDir` with `roots`; omit it for the default
  `specs` root, or list `{ dir, files?, path?, transparent? }` objects.
- Remove `id` and `navPath` from every definition. Move each file to the
  directory that should be its folder, or declare `path`. Rename the file, or
  declare `slug`, when the leaf should differ from the file name; declare
  `slug: "index"` or name the file `index.mockup.tsx` for a folder's own page.
- Replace `defineRoot`, `folder`, nested `screen`, and nested `page` with
  directories and `defineFolder` records or `_folder.json` files for titles
  and order.
- Give every variant a `slug` instead of an `id`; `variantOf` is derived.
- Replace `useCaseIds` with `useCasePaths` and step `screenId` with
  `screenPath`, using complete or relative paths.
- Export definitions from any export, default or named; `mockups` is no
  longer required.
- Replace `mockLink("<id>")` and `to="<id>"` with a complete path, a relative
  path, or an imported definition. Raw `mock:<id>` becomes `mock:<path>`.
- Declare `movedFrom` on an entry whose path changed together with its
  content so Changes pairs it with its baseline.

Migrate the released `@mokly/viewer/data` exports as follows: `entryRoute`,
`viewRoute`, `viewHref`, `snapshotViewPath`, and `snapshotResourcePath` take a
path instead of `(kind, id)`; `snapshotPagePath` becomes
`snapshotDocumentPath(side, path, colorScheme)`; `pagePreviewMetadataPath`
becomes `previewMetadataPath(path)`; `documentRoute` is new; and
`unavailableViewHref` is removed because `viewHref` of an unknown path opens
the missing view. `parseViewHref` returns a path rather than a kind and id.
Replace `ManifestV7` with `ManifestV9`, `ReviewResultV4` with
`ReviewResultV6`, and `ScreenReviewV4` with `ScreenReviewV6`. Replace
`isEntryId` and `isCatalogueId` with `isPathSegment` and `isEntryPath`;
`isWindowsDeviceName` is unchanged.

Migrate the released `@mokly/viewer` root types as follows: `CatalogueRecord`
and every node carry `path` instead of `id`, `useCasePaths` replaces
`useCaseIds`, `screenPath` replaces `screenId` in steps and in `InstanceRef`,
`CatalogueDocument` is a new record kind, `CatalogueReadModel.tree` is one
tree whose folder nodes carry `title` and optional `index`, removed entries
carry `folderTitles`, and paired entries carry `previousPath`. Viewer hosts
replace `ViewerSelection.screenId` and `ScreenNavigateEvent.screenId` with
`screenPath`.

The path identity change also removes the obsolete nested input types
`NestedFolderMarker`, `NestedPageInput`, and `NestedScreenInput` from the authoring
package, and `ViewHrefIdentity`, `navConflictKey`, `navPathKey`, and `validNavLabel`
from the viewer data package. The public replacement is the path model described
in [paths](./mokly-paths.md) and [entry modules](./mokly-entry-modules.md).

## Historical Navigation Path Upgrade Release Note

See [the historical note](./npm-release-history.md#historical-navigation-path-upgrade-release-note).

## Historical Identity Upgrade Release Note

See [the historical note](./npm-release-history.md#historical-identity-upgrade-release-note).

## Historical Comparison Baseline Release Note

See [the historical note](./npm-release-history.md#historical-comparison-baseline-release-note).

## Historical Delta Publishing Release Note

See [the historical note](./npm-release-history.md#historical-delta-publishing-release-note).

## Historical Viewer Host API Release Note

See [the historical note](./npm-release-history.md#historical-viewer-host-api-release-note).

## Boundary And Tooling Changes

`parseStaticDelivery` returns `valid`, `unsupported-version` or `invalid` results
and never throws. Callers read the descriptor from a valid result's `value`.
Browser boundary readers throw `MoklyVersionError`; export keeps `export-invalid`.
`ViewerError.code` includes `version`, with optional diagnostic `details` beside
the existing product-facing `message`.

The approved watch-writer change moves successful plain baseline notes and
the earlier-version notice to stdout;
errors and requested timing JSON retain stderr. Referenced authored files are
not private solely because of an extension or build-folder name; source inputs,
protected locations, hidden segments and symlinks remain private.

## Combined Path And Output Formats

The path/output integration uses manifest v9, catalogue v5, review v6, delivery
v5 and bootstrap v2. Live capability descriptors and the inspector wire use v2;
the live index is `live-index-2`, catalogue change snapshots use v3 and baseline
completion markers use v2 with `generated-v9`. Export ownership v3, upload v2
and Plan v1 retain their shapes. See the
[complete format inventory](./mokly-format-versions.md).

File-derived paths replace `id`/`navPath`, and `roots` replaces `entries` and
`entriesDir`. Markdown documents, folders and moves use the incoming path
contract. Every generated file now lives under `mokly-generated/`, including
Markdown resource copies. Old manifest v8 or catalogue v4 payloads from either
parent are unsupported. Rebuild with the matching package; no converter is
provided. The preview command against an earlier main base still succeeds with
Changes unavailable. Only the explicit writers take the output lock; immutable
in-memory route snapshots replace disk capture and reject undeclared worker routes.
