# Catalogue Change Metadata And Removed Pages

## Delivery Status

Implemented alongside [Pages in the catalogue](./mokly-pages.md).
Catalogue impact and removed-entry metadata are independent of the visual
[comparison result](./mokly-changes.md). Verification is tracked in
[Unified Catalogue Pages](../../plans/unified-catalogue-pages.md).

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
  changedRoutes: readonly string[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

interface RemovedEntrySnapshot {
  entry: ManifestScreen | ManifestPage | ManifestComponent;
  ancestors: readonly { id: string; title: string }[];
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
and tags. Historical screen readers normalize older supported shapes first;
pages enter `removedEntries` only from v5 or the historical page-v4 format with a real catalogue ID.
`ancestors` is the baseline's root-to-parent collection path, captured before
current hierarchy lookup. It never depends on a surviving current parent or on
serialized `navPath` labels. A removed variant screen retains its baseline
`variantOf` in the entry DTO and its parent's collection ancestry, so the
shell can place its Removed row under a surviving parent as the
[screen variants contract](./mokly-screen-variants.md) specifies; when the
parent is also removed, each is its own removed entry.

`changedRoutes` is the sorted, unique union of affected current routed entries
and the selected removed-entry routes. Current route attribution keeps the
existing ID-based metadata, material generated-output, rendered-resource, and
ancestry rules, extended with the page's single document. Apply the same paired
ignore normalization to page documents. For pages and catalogues without registered components, source paths, dependency
declarations and shared-impact matches alone do not add otherwise unchanged
entries. Component catalogues use the [ownership-aware classification](./mokly-component-changes.md)
for screens, components and flows, unioned with material/metadata page Changes. Screen impact
continues to propagate to use cases through their screen steps. Current display
metadata comes from the matching current catalogue; removed display metadata
comes from `removedEntries`. No removed-use-case support is introduced here.

Visual comparisons retain schema v2 for screen-only catalogues and schema v3
when either side contains registered components. Pages add no comparison records. Neither catalogue change detection nor page removal requires snapshot
generation. The publisher must not discover removed pages by reading
`ReviewResult.screens`; that array remains the source of screen comparisons.
The shared catalogue snapshot drives its routes, ID redirects, shell metadata,
and filter/search rows before HTML capture. It requires no additional public
endpoint or comparison JSON schema change.

## Removal Selection And Precedence

Select a baseline screen or registered page when its old route is absent from every
current routed entry. Sort removed entries by canonical route, then ID. Current
route ownership always wins, including a different entry kind reusing a route.
Never attach a removed-state view to a current route.

A current ID also wins its `/id` destination. When the same ID moves to a new
route, retain the old route's removed row/view if that route is free, but omit
its historical ID redirect. Removed rows link by their old route, not by an ID
that now opens a current entry. Reusing both ID and route leaves no historical
row at that destination. These rules preserve current removed-screen route
precedence while extending it to pages. Components additionally require their
stable ID to be absent from the current catalogue; a moved component retains
its identity and comparison on the current route.

Reject duplicate removed routes, invalid historical metadata, and snapshots
whose current catalogue or baseline commit differs from the generation being
served or captured. A failed baseline read cannot become a successful empty
removal list. Preserve the runtime's unavailable-Git behavior and watch's
last-good generation; an explicitly requested review publication fails instead
of silently omitting Changes.

## Removed-Page Presentation

When Changes is selected, append removed pages as flat root-level leaf rows
after the filtered current hierarchy, ordered by route then ID. Reuse the
existing removed-screen row style, page icon, and `removed:<route>` identity;
the visible label is `<title> · Removed`. There is no synthetic collection,
historical folder, extra App root, or expandable Removed group.

Removed-page rows are hidden from All. Preserve existing removed-screen
navigation visibility and comparison behavior; this page rule does not narrow
those screen features. Search by ID/title/route/tags and tag filtering use the
baseline metadata, with the same matching rules as current leaves. The Changes
count includes each selected removed route once. Current home totals and the
current tag picker remain based on current entries.

The removed page view shows an explicit missing-current state. Its details show
the baseline title, ID, description, tags, dependencies, related docs, and
root-to-parent breadcrumb labels. Historical ancestors are informational text,
not collection nodes or links that pretend the old hierarchy still exists.
Changing a surviving ancestor's title does not rewrite those baseline labels.
Keep the view available by its retained route even when All is selected.

For example, deleting both `documents` and its `statement` page leaves a flat
`Statement · Removed` row in Changes. Details retain its old Documents ancestry;
neither navigation nor the home view recreates the deleted collection. Mockups
must cover this exact state at mobile and desktop widths before UI work begins.

## Watch And Publication

Recompute current impact, removed metadata, and baseline ancestry together when
watch replaces a validated generation, before notifying the browser. Navigation,
counts, details, and routes must never mix snapshots from separate generations.
Publication with Changes uses the same snapshot and baseline commit as its
screen comparison capture, with safely escaped metadata in the captured shell.

The [publication option](./mokly-publication.md) defaults to current entries
only: no catalogue-change snapshot is computed or exported. With Changes
included, retain removed page routes, permitted ID redirects, and missing-current
views from this model. Pages still generate no visual comparison snapshots.
Unsupported unmatched v2/v3 legacy documents stay historical artifact records,
as specified by [migration](./mokly-page-migration.md).

## Acceptance

Use generic fixtures for removing a page, removing its parent and all ancestors,
renaming a surviving parent, reusing a route across kinds, and moving/reusing an
ID. Assert identical removed metadata, route precedence, and counts in server,
watch, and opted-in publication; preserve screen comparison regression coverage.
Test filters/search, All versus Changes visibility, direct old-route access,
baseline breadcrumbs, no recreated collections, unavailable/malformed baselines,
and zero Git/comparison work for publication without Changes.

The validated serving/publication snapshot also retains component ownership
classification from the same pinned baseline. No-watch Serve and publication
reuse that evidence for every route, including saved component variants; they
never retry or resolve a newer baseline while rendering the snapshot. Watched
component serving retains its generation-aware live cache.
