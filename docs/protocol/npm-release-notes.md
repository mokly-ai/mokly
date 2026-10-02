# npm Release Notes

## Unreleased Breaking-Change Coverage

Before a close-out commit, `npm-release-notes.md` must name every `feat!`
commit returned by
`git log --oneline origin/main..HEAD | grep 'feat!'`. The current coverage is:

- `7aba5ec2 feat!: replace collections with navigation paths` — the navigation
  path note below;
- `d227702e feat!: close out id-derived routes plan` — the identity note;
- `40ab4324 feat!: drop comparisons against older baselines` — the comparison
  baseline note;
- `c16926ba feat!: close out id-derived routes review fixes` — the baseline and
  viewer host notes; and
- `52ca8548 feat(publish)!: upload catalogue content deltas` — the delta
  publishing note.

## Breaking Path Identity Release Note

The path identity upgrade replaces authored `id` and `navPath` with one path
per entry derived from the file that defines it, adds Markdown documents,
detects moves, renames the Pages section to Specs, and changes the generated
layout to one directory per entry. Consumers adopt manifest v8, catalogue read
model v4, review result v5, and the `/view/<path>/` URL. There is no
compatibility layer: earlier manifests, read models, review results, and
stored navigation state are neither read nor translated, former
`/view/<kind>/<id>.html` URLs are not redirected, former ids are not mapped to
paths, and former configuration keys fail as unknown fields. An earlier
comparison base makes Changes unavailable until it includes this version.

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
Replace `ManifestV7` with `ManifestV8`, `ReviewResultV4` with
`ReviewResultV5`, and `ScreenReviewV4` with `ScreenReviewV5`. Replace
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

## Breaking Navigation Path Upgrade Release Note

The navigation-path upgrade removes `defineCollection`, `collection`, and their
exported types; adds per-entry `navPath` and nested `folder()` authoring; and
replaces collection edges with independent section folder trees. Consumers must
regenerate manifest v7 and adopt catalogue read model v3. Obsolete
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
manifest v7, catalogue v3, review v4, and delivery v3; `/id/` URLs no longer
exist.

Migrate the released `@mokly/viewer/data` exports as follows:

- Replace `catalogueViewHref` with `viewHref`: change the arguments from
  `(route)` to `(kind, id)`. Callers pass entry identity instead of a stored
  route.
- Remove `publicPath` calls. Catalogue v3 has no public document or view path
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
- Replace `ManifestV5` with `ManifestV7`, `ReviewResultV3` with
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

Export ownership marker schema 2 replaces schema 1. Each owned file is recorded
as `{ path, sha256, size }`, and the marker covers the exact finalized bytes that
the exchange addresses. Export folders written by earlier releases are not
recognized as owned: move any files you added, delete the old export folder,
and export again. The public `export-ownership-v1.json` compatibility fixture is
removed; receiver conformance uses `export-ownership-v2.json`.

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
