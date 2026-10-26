# npm Release Notes

## Breaking Rust Rebuild Release Note

The first Rust core release is a breaking 0.x minor release. The
[complete upgrade note](./npm-release-notes-formats.md#first-rust-core-release)
covers native targets, removed commands, JSON configuration, HTML authoring,
source comparisons, caches, formats, and the required Mokly Cloud reset.

JSON configuration removes `defineConfig`, `componentStylesheets`,
`ModuleResolutionConfig`, `ReviewConfig`, `StylesheetRule`, `WatchAction`,
`WatchConfig`, and `WatchRule`.
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

## Breaking Comparison Records Release Note

A comparison generation no longer contains `review.json`. The catalogue index
moves to version 8: it adds `baseCommit`, and its `comparisonUrl` names the
generation's root instead of a file. Each screen and component view of an
entry detail carries its review `state` and `ignoredIds`, and a detail carries
the base side's `before` address; the detail stays version 2. Serve replaces
`/mokly-viewer/diffs/review.json` with `/mokly-viewer/diffs/selection`. The
upload envelope moves to version 3 without `comparisonPath`, and the Plan
request sends `mokly-viewer/index.json` in place of the review file. A
receiver reads Changes from the index, so Mokly Cloud must accept upload v3
and index v8 before it can store a publication of this release.

## Historical Generated Output And Manifest API Release Note

See [the historical note](./npm-release-history-0-15.md#historical-generated-output-and-manifest-api-release-note).

## Historical Path Identity Release Note

See [the historical note](./npm-release-history-0-15.md#historical-path-identity-release-note).

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
the first Rust core release. The npm 0.15.0 boundary, tooling, and format
notes are in [npm 0.15.0 upgrade notes](./npm-release-history-0-15.md).
