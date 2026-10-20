# npm Release Notes

## Generated Output And Manifest API

`MoklyConfig` no longer accepts `generatedOutput` or `publicExclude`.
`mockupsDir` names the authored catalogue root, and all generated files live in
its `mokly-generated/` child. Only Build, `build --watch` and `serve --build`
write that tree. Plain Serve, export and publish compile in memory. Check uses
Git-index tracking to choose its tracked or untracked validation boundary.
Remove the old options; no default-output mode replaces them.

Manifest v10 replaces the released manifest v9. `@mokly/viewer/data` no longer
exports the manifest types. The
[viewer data release note](#breaking-viewer-data-release-note) lists them.
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

## Breaking Rust Rebuild Release Note

The first Rust core release is a breaking 0.x minor release. The
[complete upgrade note](./npm-release-notes-formats.md#first-rust-core-release)
covers native targets, removed commands, JSON configuration, HTML authoring,
source comparisons, caches, formats, and the required Mokly Cloud reset.

JSON configuration removes `defineConfig`, `ModuleResolutionConfig`,
`ReviewConfig`, `StylesheetRule`, `WatchAction`, `WatchConfig`, and `WatchRule`.
The unified authoring model removes `ComponentEntryDefinition`,
`ComponentProps`, `ComponentRenderContext`, `ComponentVariant`,
`ComponentVariantDefinition`, `RegisteredComponent`, and `RegistryDefinition`.
The CLI also stops exporting `ComponentInstanceRecord`, `ComponentPropsData`,
`ComponentResourceOwnership`, `ComponentSourceLocation`,
`ComponentStyleOwnership`, `PropPrimitive`, and `PropValue`. Use the current
entry props and viewer records. Import `resolveInstance` and
`InstanceResolution` only from `@mokly/viewer`.

## Breaking Viewer Delivery Release Note

The Browse shell renders only in the browser, from the catalogue index v7 and
one entry detail v2 per entry under the
[shell delivery contract](./mokly-shell-delivery.md). `@mokly/viewer/server`
and `@mokly/viewer/runtime` are removed, and `@mokly/viewer/browser` mounts
the standalone shell without `hydrateMoklyShell`. `MoklyViewer` takes an
`index` source and a `detail` source and has no `viewerId`. `readCatalogueIndex`
and `readEntryDetail` replace `readCatalogue`; `IndexSource`, `DetailSource`
and `DetailResult` replace `CatalogueSource` and `CatalogueFetcher`. Prop
schemas follow the JSON Schema profile of the
[entry props contract](./mokly-entry-props.md): `PropSchema` and
`validatePropSchema` replace `ObjectPropSchema`, `DataPropSchema`,
`DataPropField`, `InferProp` and `ControlFor`. `@mokly/viewer/data` no longer
exports `parseStaticDelivery`, `StaticDelivery`, `StaticDeliveryParseResult`
or `RenderCapability`; the standalone shell reads the live descriptor v3.

## Breaking Viewer Data Release Note

`@mokly/viewer/data` exports only the path functions, the directory names, the
path and link grammar, and the prop schema validators that the
[viewer contract](./mokly-viewer.md) lists. Review result v8 replaces the review
v7 and manifest types, so the entry no longer exports them or their readers and
helpers. Import `ColorScheme`, `Viewport`, and `MoklyVersionError` from
`@mokly/viewer`. The entry also stops exporting `AffectedConsumer`,
`AffectedUsageEvidence`, `ArtifactView`, `CatalogueHierarchy`, `ChangedEntry`,
`ComponentControl`, `ComponentControlLabel`, `ComponentRenderError`,
`ComponentRenderRequest`, `ComponentRenderSuccess`, `ComponentReview`,
`ComponentUsageContext`, `ComponentValidationError`, `ComponentVariantReview`,
`DataBudget`, `DependencyReason`, `EntryChangeReason`, `ExcludedResource`,
`GeneratedComponentView`, `HierarchyEntry`, `HierarchyFolder`, `HierarchyNode`,
`HistoricalManifest`, `HistoricalManifestEntry`, `HistoricalManifestPage`,
`HistoricalManifestScreen`, `HistoricalManifestUseCase`,
`HistoricalSnapshotSource`, `HtmlSourceLocation`, `LogicalTarget`, `Manifest`,
`ManifestDocument`, `ManifestEntry`, `ManifestEntryBase`, `ManifestFolder`,
`ManifestPage`, `ManifestScreen`, `ManifestV10`, `RemovedPagePreview`,
`RemovedPagePreviewArtifact`, `ReservedAttributeName`,
`ReservedAttributeOccurrence`, `ResolvedCatalogueEntry`, `ReviewArtifact`,
`ReviewArtifactContent`, `ReviewEntryAddress`, `ReviewResult`,
`ReviewResultV7`, `ReviewState`, `ReviewVariantAddress`,
`ScreenResourceEvidence`, `ScreenReview`, `ScreenReviewV7`, `VIEWPORTS`,
`ViewResourceEvidence`, `ViewReview`, `affectedConsumerOrderKey`,
`analyzeHierarchy`, `canonicalJson`, `catalogueComponentVariants`,
`compareNavigationNodes`, `comparisonGeneration`, `comparisonPath`, `counter`,
`currentCatalogueEntries`, `decodeProps`, `decodeValue`,
`duplicateReservedAttributeName`, `effectiveColorSchemes`, `encodeProps`,
`encodeUrlPath`, `exactKeys`, `firstPathCaseCollision`, `fragmentViews`,
`generatedViews`, `historicalSnapshotId`, `instanceKey`, `invalidData`,
`isHistoricalSnapshotId`, `isKebabCase`, `isManifestComponentVariant`,
`isPortableUrlPath`, `isSafeCatalogueRoute`, `isSafeRepositoryPath`,
`isStylesheetPath`, `lexical`, `logicalMarker`, `parseBrowsingTarget`,
`parseLogicalMarker`, `parseLogicalTarget`, `parseRemovedPagePreview`,
`parseReviewResult`, `plainKeys`, `projectTree`, `readControls`, `readInstance`,
`readProps`, `readRange`, `readSchema`, `readSlot`, `relatedDoc`,
`renderStatus`, `repositoryPath`, `requireEqual`,
`reservedAttributesInStartTag`, `resolveCatalogueEntry`,
`resolveCatalogueSelection`, `resolveLinkPath`, `reviewInvalid`,
`reviewMaterialKey`, `serializeBrowsingTarget`, `slotKey`, `sortedStrings`,
`validateComponentSource`, `validateComponentViewRecord`,
`validateComponentViews`, `validateControlledValues`, `validateControls`, and
`validateResourcePath`. These have no public replacement.

The entry also removes `CssPageEvidence`, `CssRuleAttribution`,
`DependencyAnalysis`, `InsertedComponentStylesheet`, `PageResourceEvidence`,
`ResourceEvidence`, `cssAnalysis`, and `mergeCssAnalysis`.

## Breaking Path Identity Release Note

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
[viewer data release note](#breaking-viewer-data-release-note) lists the
removed names. Replace
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

## Historical Publish Checkout Release Note

See [the historical note](./npm-release-history.md#historical-publish-checkout-release-note).

## Historical Removed Options Release Note

See [the historical note](./npm-release-history.md#historical-removed-options-release-note).

## Historical Portable Namespace Release Note

See [the historical note](./npm-release-history.md#historical-portable-namespace-release-note).

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

See [format and tooling release notes](./npm-release-notes-formats.md) for
boundary changes and the combined path and output formats.
