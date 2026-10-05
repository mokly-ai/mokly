# npm Release Notes

## Unreleased Breaking-Change Coverage

The squash-merge commit uses `!` and `BREAKING CHANGE:` footers for the
contracts below. Release Please owns package versions and changelogs. The
[public API reports](./verification-api-members.md#public-api-reports) cover
all typed package entry points and the non-code export inventory. Any report
change relative to `origin/main` requires a release-note change in that diff.
The existing released-export-name check remains independent.

## Generated Output And Manifest API

`MoklyConfig` no longer accepts `generatedOutput` or `publicExclude`.
`mockupsDir` names the authored catalogue root, and all generated files live in
its `mokly-generated/` child. Only Build, `build --watch` and `serve --build`
write that tree. Plain Serve, export and publish compile in memory. Check uses
Git-index tracking to choose its tracked or untracked validation boundary.
Remove the old options; no default-output mode replaces them.

`ManifestV8` replaces `ManifestV7`. The `Manifest` and `HistoricalManifest`
aliases now name v8. V8 requires `assetClosure`, `generatedFiles` and
`blobHashAlgorithm` in addition to the identity-only entries and source
inventory. Regenerate this data with Build; do not hand-convert old manifests.
Only v8 is readable as baseline content. Earlier-version detection returns the
existing unavailable outcome, which is never cached.

## Removed Public Options And Types

The current API has no document transformation bridge. Remove
`MoklyConfig.compatibility` and `compatibility.transformer`. The
`CompatibilityConfig`, `CompatibilityTransformer` and
`CompatibilityTransformInput` exports are removed from `@mokly/mokly`.
Render portable HTML and links directly in entries or the configured renderer.
Supplying `compatibility`, including `undefined`, fails with
`compatibility was removed; author portable links directly`.

Catalogue v4 has one fixed layout. The branch-only `generatedPathPrefix`,
`GeneratedPathPrefix`, `FrameMount.generatedPathPrefix` and `FrameMount.route`
never shipped and have no migration API. `currentDocumentPath(route)` and
`currentDocumentRoute(pathname)` use `GENERATED_DIRECTORY` directly. The
catalogue schema version is 4. No DOM prefix override is supported.

Export directories require the current v3 ownership marker or must be empty.
There is no preview-marker migration. Baseline caches accept only complete v8
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

Readers accept source manifest v8, public catalogue v4, delivery v4 and
bootstrap v1 only. The namespace change advances ownership to v3 and upload to
v2 while retaining Plan v1 and content deltas. These supersede the intermediate
format numbers in the earlier upgrade notes below. An older receiver returns
426 with the documented service-version message; an incompatible viewer fails
before reading paths. Mokly Cloud requires the separate receiver/viewer update.
See [namespace compatibility](./mokly-viewer-namespace.md#compatibility-failure).

## Breaking Navigation Path Upgrade Release Note

The unified-output contract supersedes the format versions in these earlier
upgrade notes: use source manifest v8, catalogue v4, delivery v4 and bootstrap v1.
`ManifestV8` replaces `ManifestV7` in `@mokly/viewer/data`. The identity and
navigation migrations below still apply. See the
[manifest contract](./mokly-generated-manifest.md) for the v8-only baseline gate.

The navigation-path upgrade removes `defineCollection`, `collection`, and their
exported types; adds per-entry `navPath` and nested `folder()` authoring; and
replaces collection edges with independent section folder trees. Consumers must
regenerate manifest v8 and adopt catalogue read model v4. Obsolete
`collection:` disclosure keys are ignored on restore.

Migrate the released `@mokly/mokly` exports as follows:

- Replace `defineCollection` and its `CollectionInput` with `defineRoot` and
  `RootInput` when authoring a tree, or put `navPath` directly on independent
  entries. Nesting now defines membership, so remove `childIds`.
- Remove `CollectionDefinition`; folders are structure, not
  `RegistryDefinition` entries, and therefore have no id, description, or
  rationale of their own.
- Replace `collection` and `NestedCollectionInput` with `folder` and
  `NestedFolderInput`. Keep `title`, `children`, and inherited metadata, but
  remove the former `id`, `description`, `rationale`, and `segment` fields;
  `title` is the navigation-path label.
- Replace `RoutedEntryInput` with `EntryInput`, omit `route`, and supply
  `navPath` only when the entry belongs below folder labels. Kind and id derive
  the document path.

## Breaking Identity Upgrade Release Note

The identity upgrade derives paths from kind and id, removes authored `route`,
`slug`, `segment`, and root `path`, and makes component variants global entries.
The `defineComponent()` return changes from `.entry` to `.entries`; export that
parent-first array of the component and its variant entries. Consumers adopt
manifest v8, catalogue v4, review v4, and delivery v4; `/id/` URLs no longer
exist.

Migrate the released `@mokly/viewer/data` exports as follows:

- Replace `catalogueViewHref` with `viewHref`: change the arguments from
  `(route)` to `(kind, id)`. Callers pass entry identity instead of a stored
  route.
- Remove `publicPath` calls. Catalogue v4 has no public document or view path
  fields to validate; derive documents with `entryRoute` using `(kind, id)` and
  rendered views with `viewRoute` using
  `(kind, id, viewport, colorScheme)` when an artifact path is required.
- Replace `pagePreviewPath` with `pagePreviewMetadataPath` for the metadata file
  inside a comparison generation, changing the argument from the complete
  generation-prefixed path to `(id)`. Use `snapshotPagePath` with `(id)` for the
  retained page document.
- Replace `componentFragmentRoute` with `viewRoute`: change the arguments from
  `(route, variantId, viewport, colorScheme?)` to
  `("component", variantId, viewport, colorScheme?)`. The component parent's
  route is no longer an argument because every variant is an entry.
- Replace `ManifestV5` with `ManifestV8`, `ReviewResultV3` with
  `ReviewResultV4`, and `ScreenReviewV3` with `ScreenReviewV4`. The current
  types use identity and view axes instead of stored artifact routes.

Migrate the released `@mokly/viewer` root types as follows:

- Replace `CatalogueCollection` with the `kind: "folder"` branch of
  `CatalogueNode` and consume folders through `CatalogueReadModel.tree`.
  Folders are structural and no longer carry collection ids, entry metadata,
  or `childIds`.
- Replace `CatalogueRoutedEntry` with `CatalogueRecord`. The current union
  addresses catalogue records by kind and id and has no stored route.
- Replace `CatalogueVariant` with `CatalogueComponentVariant`. A component
  variant is now a complete catalogue entry with global identity, navigation
  metadata, and `variantOf` instead of a local object inside its parent.

Entry ids now reject a value that is exactly `aux`, `con`, `nul`, `prn`,
`com1` through `com9`, or `lpt1` through `lpt9`, using the case-insensitive
`isWindowsDeviceName` rule. This applies to every global entry id, including
screen and component variants, because the id becomes a filename stem; tags,
logical-link syntax, and `ReviewIgnore` ids retain the plain kebab-case grammar.
Registry preparation reports `invalid-id` with
`id must be globally unique kebab-case`; component authoring can report the
same detail, or `variant id must be globally unique kebab-case`, at its earlier
validation boundary. Rename the entry to a descriptive kebab-case id that is
not one of those reserved device names and update references to it.

The old `?variant=<id>` query is no longer a selector. The current route parser
opens the entry named by the URL pathname and ignores every `variant` query
value, so a parent URL stays on the parent rather than opening that id; the
unrecognized query can remain in the initially loaded address, but Mokly's next
generated navigation does not carry it. Link a variant as its own entry with
`viewHref(kind, variantId)`.

## Breaking Comparison Baseline Release Note

Comparisons require a base built by this Mokly version. An earlier base makes
Changes unavailable until the base includes this version, while export and
publish still complete without Changes.

## Breaking Delta Publishing Release Note

`mokly publish` now uses the content-addressed Plan, Blob, and Complete exchange
instead of sending one archive containing the complete exported catalogue.
Independent receivers must accept the v1 Plan archive, answer with the missing
content digests and upload URLs, verify raw Blob PUTs by digest and size, and
make Complete idempotent under the documented first-publication rule. Clients
upload only content the receiver does not already hold.

Export ownership marker schema 3 records each owned file
as `{ path, sha256, size }`, and the marker covers the exact finalized bytes that
the exchange addresses. Export folders written by earlier releases are not
recognized as owned: move any files you added, delete the old export folder,
and export again. The public `export-ownership-v1.json` compatibility fixture is
removed; receiver conformance uses `export-ownership-v3.json`.

The new `--upload-concurrency <n>` publish option controls parallel Blob PUTs.
It accepts integers from 1 through 32 and defaults to 8.

## Breaking Viewer Host API Release Note

Viewer hosts must remove `ViewerSelection.variantId` and
`InstanceRef.variantId`; `ScreenNavigateEvent` removes `route` and `variantId`
and becomes `{ screenId, snapshotId?, fragment?, navigation? }`. Its optional
`snapshotId` is present only when the committed historical record publishes an
opaque identity.

Release notes and the close-out commit use a `BREAKING CHANGE:` footer naming
the applicable upgrades above; the release PR owns versions and changelogs.

## Boundary And Tooling Changes

`parseStaticDelivery` returns `valid`, `unsupported-version` or `invalid` results
and never throws. Callers read the descriptor from a valid result's `value`.
Browser boundary readers throw `MoklyVersionError`; export keeps `export-invalid`.
`ViewerError.code` includes `version`, with optional diagnostic `details` beside
the existing product-facing `message`.

Successful plain baseline notes and the earlier-version notice use stdout;
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
