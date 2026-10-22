# npm 0.15.0 Upgrade Notes

These notes shipped with npm 0.15.0 and describe the upgrade from 0.14. They
retain their original format numbers. Current changes are in
[npm release notes](./npm-release-notes.md), and older notes are in
[historical npm upgrade notes](./npm-release-history.md).

## Historical Generated Output And Manifest API Release Note

`MoklyConfig` no longer accepts `generatedOutput` or `publicExclude`.
`mockupsDir` names the authored catalogue root, and all generated files live in
its `mokly-generated/` child. Only Build, `build --watch` and `serve --build`
write that tree. Plain Serve, export and publish compile in memory. Check uses
Git-index tracking to choose its tracked or untracked validation boundary.
Remove the old options; no default-output mode replaces them.

Manifest v10 replaces the released manifest v9. `@mokly/viewer/data` no longer
exports the manifest types. The
[viewer data release note](./npm-release-notes.md#breaking-viewer-data-release-note) lists them.
V10 still requires `assetClosure`, `generatedFiles` and `blobHashAlgorithm` in
addition to the identity-only entries and source inventory.
The combined shape requires root ranges and inserted-stylesheet provenance, and
removes source dependency declarations.
Only valid v10 baselines are read. npm 0.14.0 output (manifest v9, catalogue v5
and review v6) is earlier output.
Former manifest filenames no longer act as sentinels. Missing canonical output
uses normal absence and rebuild selection.
Rebuild committed `mokly-generated/` once with Build, commit it, and regenerate
exports. Do not hand-convert manifests.
An earlier base gives Changes unavailable with the existing message. Build,
Serve, export and publish succeed. Earlier outcomes are never cached.

## Historical Path Identity Release Note

The path identity upgrade removes `id`, `navPath`, `entries`, and `entriesDir`.
The removed nested authoring types include `NestedFolderInput` and `RootInput`.
Each entry has one path derived from its discovered exporting file. It adds Markdown
documents and move detection, renames Pages to Specs, and gives each entry a
generated directory. Consumers must adopt manifest v10, catalogue read model
v6, review result v7, disclosure storage v4, and `/view/<path>/` URLs.

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
needs `exactOptionalPropertyTypes` for a type error. Strict commands count these
warnings before any output write or upload.
Declare separately authored component CSS with `stylesheets` and place it with
`componentStylesheets` when
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
source dependency list. The combined current formats use new versions:
manifest v10 includes root ranges and `insertedStylesheets` with
`componentPaths`; catalogue v6 carries view/page `resourceEvidence`; review v7
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
The released manifest and review result types, such as `ManifestV7` (0.13.0),
`ManifestV9` (0.14.0), `ReviewResultV6`, and `ScreenReviewV6`, have no public
replacement. The
[viewer data release note](./npm-release-notes.md#breaking-viewer-data-release-note) lists their
0.15.0 successors, such as `ManifestV10` and `ReviewResultV7`, which the first
Rust core release removes. Replace
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

## Historical Boundary And Tooling Release Note

`parseStaticDelivery` returns `valid`, `unsupported-version` or `invalid`
results and never throws. Callers read the descriptor from a valid result's
`value`. Browser boundary readers throw `MoklyVersionError`; export keeps
`export-invalid`. `ViewerError.code` includes `version`, with optional
diagnostic `details` beside the existing product-facing `message`.

`MoklyVersionError.boundary` now also accepts `"review"`. The review reader
throws that error for numeric versions other than 7 before reading content.
Comparison requests preserve its code, boundary, received version and supported
version. Malformed current results keep a plain invalid-review error with one
`[mokly/review]` prefix. Comparison failures use the existing compatible-viewer
message, with version numbers only in diagnostic details. Embedded viewers emit
`onError` with code `"version"`; Current remains available without comparison panes.

The watch-writer change that was to move successful plain baseline notes and
the earlier-version notice to stdout is frozen with the TypeScript backend and
never landed; errors and requested timing JSON retain stderr. Referenced authored files are not private solely because of an extension
or build-folder name; source inputs, protected locations, hidden segments and
symlinks remain private.

## Historical Combined Path And Output Formats Release Note

The path/output integration uses manifest v10, catalogue v6, review v7, delivery
v5 and bootstrap v2. Live capability descriptors and the inspector wire use v2;
the live index is `live-index-2`, catalogue change snapshots use v3 and baseline
completion markers use v2 with `generated-v10`. Export ownership v3, upload v2
and Plan v1 retain their shapes. See the
[complete format inventory](./mokly-format-versions.md).

File-derived paths replace `id`/`navPath`, and `roots` replaces `entries` and
`entriesDir`. Markdown documents, folders and moves use the incoming path
contract. Every generated file now lives under `mokly-generated/`, including
Markdown resource copies. Manifest v9 and below are earlier baseline output;
catalogue v5 and review v6 and below are unsupported public payloads. Rebuild
with the matching package; no converter is provided. The preview command against
an earlier main base still succeeds with Changes unavailable. Only the explicit
writers take the output lock; immutable in-memory route snapshots replace disk
capture and reject undeclared worker routes.
