# Catalogue Change Metadata And Removed Pages

## Delivery Status

Implemented alongside [Pages in the catalogue](./mokly-pages.md), with removed
screen-variant metadata and publication implemented through Milestone 4 of the
[screen variants plan](../../plans/screen-variants.md). Catalogue impact and
removed-entry metadata are independent of the visual
[comparison result](./mokly-changes.md). Page verification is tracked in
[Unified Catalogue Pages](../../plans/unified-catalogue-pages.md). Baseline
documents, ancestry, and delivery descriptors for removed pages are implemented
by the [removed content previews plan](../../plans/removed-content-previews.md).

## Shared Metadata Contract

One package-internal catalogue-change module owns this typed snapshot and its
pure selection rules. The Git-backed loader supplies the validated current
manifest, validated historical manifest, and a single resolved branch-point
commit. Server, watcher, preview capture, and publication consume the same
snapshot for a catalogue generation:

```ts
interface CatalogueChangeSnapshot {
  schemaVersion: 1;
  baseRef: string;
  baseCommit: string;
  changedIds: readonly string[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

interface RemovedEntrySnapshot {
  entry:
    | ManifestScreen
    | ManifestPage
    | ManifestComponent
    | ManifestComponentVariant;
}
```

No-watch Serve validates the successfully written compilation's manifest and
resolves its optional Changes exactly once before handing that catalogue
snapshot to HTTP. HTTP consumes the supplied snapshot without rereading the
manifest or retrying Git. Child startup uses the same validation and optional
history loader when no snapshot was supplied. A failed optional calculation
omits the entire Changes result, including removed entries; there is no separate
startup route-list fallback. Invalid current manifests or stale source inventories
still prevent listening. This startup guarantee does not pin a later, explicitly
requested on-demand screen comparison to the startup Git state.

The entry types are the validated manifest DTOs, including their common metadata
and tags. The historical reader normalizes older supported shapes first, so a
stored v3–v6 route never enters the snapshot; pages enter `removedEntries` only
from v5–v7 or the historical page-v4 format with a real catalogue ID. A removed
record carries no route: its URL and artifact names derive from its kind and
id. The removed entry retains the baseline's root-to-parent `navPath` labels in
its entry DTO, independent of a surviving current folder. A removed variant of
either kind retains its baseline `variantOf` and its parent's `navPath`, so the
shell can place its Removed row under a surviving parent as the
[variant contract](./mokly-variants.md) specifies; when the parent is also
removed, each is its own removed entry. `variantOf` is not a parallel snapshot
field: retaining the complete baseline DTO preserves it on schema-v5–v7
baselines and on the variant entries the historical reader builds from v3–v6
component saved variants, while historical v3/v4 screens simply omit it.

`changedIds` is the sorted, unique union of affected current entry ids and the
selected removed-entry ids. Current entry attribution keeps the
existing ID-based metadata, material generated-output, rendered-resource, and
ancestry rules, extended with the page's single document. Apply the same paired
ignore normalization to page documents. For pages and catalogues without registered components, source paths, dependency
declarations and shared-impact matches alone do not add otherwise unchanged
entries. Component catalogues use the
[path evidence rule](./mokly-component-changes.md#dependencies-and-styles)
for screens, components and flows, unioned with material/metadata page Changes. Screen impact
continues to propagate to use cases through their screen steps. Current display
metadata comes from the matching current catalogue; removed display metadata
comes from `removedEntries`. No removed-use-case support is introduced here.

Visual comparisons use [review result v4](./mokly-changes.md#comparison-engine)
for every catalogue. Pages add no comparison records. Neither catalogue change detection nor page removal requires snapshot
generation. The publisher must not discover removed pages by reading
`ReviewResult.screens`; that array remains the source of screen comparisons.
The shared catalogue snapshot drives its removed-entry pages, shell metadata,
and filter/search rows before HTML capture. It requires no additional public
endpoint or comparison JSON schema change.

## Removal Selection And Precedence

Removal is keyed by id for every kind: select a baseline screen, registered
page, component, or variant when no current entry has its id. Sort removed
entries by kind then id, with a parent's variants directly after it in authored
order, as the [catalogue contract](./mokly-catalogue.md#serialization-identity-and-versions)
defines. A current entry excludes historical content with its id unless a
snapshot is requested; a different entry kind reusing an id is still a current
entry. Never attach a removed state to a current entry.

A removed variant of either kind follows these same selection and precedence
rules. Its relationship does not make it subordinate for selection: deleting
only the variant yields one removed entry, while deleting both parent and
variant yields one removed entry for each. A surviving parent does not claim
or suppress the variant's Removed row. Moving an entry between folders changes
its `navPath`, not its id, so it stays one changed entry rather than a removal
and an addition.

Reject duplicate removed ids, invalid historical metadata, and snapshots
whose current catalogue or baseline commit differs from the generation being
served or captured. A failed baseline read cannot become a successful empty
removal list. Preserve the runtime's unavailable-Git behavior and watch's
last-good generation; an explicitly requested review publication fails instead
of silently omitting Changes.

## Removed-Page Presentation

When Changes is selected, append removed pages as flat root-level leaf rows
after the filtered current hierarchy, ordered by id. Reuse the existing
removed-screen row style, page icon, and removed-row identity; the visible
label is `<title> · Removed`. There is no recreated folder, historical folder,
extra App root, or expandable Removed group.

A removed row's identity is `removed:<id>`. It is unique because a removed
record exists only while no current entry has that id.

Removed-page rows are hidden from All. Preserve existing removed-screen
navigation visibility and comparison behavior; this page rule does not narrow
those screen features. A removed variant of either kind is the one exception to
the flat root-level placement: while its `variantOf` still names a current
non-variant entry of its kind, its Removed row belongs inside that parent's
variant list, after the parent's current variants, and is hidden from All like
a removed page. A parent with no current variants discloses the list for it.
Once the parent is gone, the variant takes the ordinary flat row. Search by id,
title, and tags and tag filtering use the baseline metadata, with the same
matching rules as current leaves. The Changes count includes each selected
removed entry once. Current home totals and the current tag picker remain
based on current entries.

The removed page view shows the baseline document from the same snapshot, under
the [removed previews](./mokly-removed-previews.md) contract. Its details show
the baseline title, ID, description, tags, dependencies, related docs, and
root-to-parent `navPath` labels. Historical labels are informational text,
not folder nodes or links that pretend the old hierarchy still exists.
Changing a surviving folder label does not rewrite the baseline labels.
Keep the view available at its derived URL even when All is selected.

For example, removing the last entry in `Documents` leaves a flat
`Statement · Removed` row in Changes. Details retain its old Documents path;
neither navigation nor the home view recreates the old folder. Mockups
must cover this exact state at mobile and desktop widths before UI work begins.

## Watch And Publication

Recompute current impact, removed metadata, and baseline ancestry together when
watch replaces a validated generation, before notifying the browser. Navigation,
counts, details, and previous-version views must never mix snapshots from
separate generations.
Publication with Changes uses the same snapshot and baseline commit as its
screen comparison capture, with safely escaped metadata in the captured shell.

The [publication option](./mokly-publication.md) defaults to current entries
only: no catalogue-change snapshot is computed or exported. With Changes
included, retain removed page rows and previous-version views from this model.
Static delivery packages each removed
page preview and its historical resource closure in the comparison generation;
pages still generate no visual comparison records.
Unsupported unmatched v2/v3 legacy documents stay historical artifact records,
as specified by [migration](./mokly-page-migration.md).

## Acceptance

Use generic fixtures for removing a page and its now-empty ancestor folders,
renaming a surviving folder, reusing an id across kinds, and moving an entry
between folders. Assert identical removed metadata, current-entry precedence,
and counts in server, watch, and opted-in publication; preserve screen
comparison regression coverage. Test filters/search, All versus Changes
visibility, direct access to a removed entry's derived URL, baseline
breadcrumbs, no recreated folders, unavailable/malformed baselines, and zero
Git/comparison work for publication without Changes.

The validated serving/publication snapshot also retains component ownership
classification from the same pinned baseline. No-watch Serve and publication
reuse that evidence for every entry, including component variants; they
never retry or resolve a newer baseline while rendering the snapshot. Watched
component serving retains its generation-aware live cache.
