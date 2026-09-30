# npm Release Notes

## Unreleased Breaking-Change Coverage

Before a close-out commit, `npm-release-notes.md` must name every `feat!`
commit returned by
`git log --oneline origin/main..HEAD | grep 'feat!'`. The current coverage is:

- `f439de0c feat!: infer inline style ownership` — the renderer ownership
  note below.

The navigation, identity, baseline and viewer-host notes also cover the
changes integrated from main's squash; its pre-squash commits are not ancestors
of this branch and do not appear in the coverage command.

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

## Breaking Viewer Host API Release Note

Viewer hosts must remove `ViewerSelection.variantId` and
`InstanceRef.variantId`; `ScreenNavigateEvent` removes `route` and `variantId`
and becomes `{ screenId, snapshotId?, fragment?, navigation? }`. Its optional
`snapshotId` is present only when the committed historical record publishes an
opaque identity.

## Breaking Renderer Ownership Release Note

Custom renderers return only the complete HTML string. Remove object-shaped
`RenderResult` returns and its type from `@mokly/mokly` imports. The released
`ComponentStyleOwnership` and `ComponentResourceOwnership` types were removed
from `@mokly/viewer/data` as well as the root viewer and Mokly exports.
Remove `styles` and `resources` from current usage records: Mokly
infers inline-rule ownership and uses declared `ownedDependencies` for files.
Historical v7 readers discard array-valued retired keys without weakening
other validation; the current manifest remains v7.

Both `@mokly/viewer/data` validators remove positional booleans and obsolete
component-root arguments. Use
`validateComponentViews(value, components, at, { dark, historical? })` and
`validateComponentViewRecord(view, components, at, { historicalUsage? })`.
The fourth options object is required; pass `{}` for current single-view usage.
`historical` defaults to false and is only for historical manifest retirement;
`historicalUsage` defaults to false and is only for already-admitted historical
catalogue usage, never for accepting retired manifest keys. The
[usage validation contract](./mokly-component-usage-records.md#validation)
defines strict option shapes and the typed rejection of old calls.

Release notes and the close-out commit use a `BREAKING CHANGE:` footer naming
the applicable upgrades above; the release PR owns versions and changelogs.
