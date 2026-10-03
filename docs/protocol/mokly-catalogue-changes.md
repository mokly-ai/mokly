# Catalogue Change Metadata And Removed Pages

## Delivery Status

Catalogue impact/removal metadata uses kind and path, with baseline folder
titles for removed entries. Documents use page-style material and removal rules. Move detection remains planned
in the [path identity plan](../../plans/path-identity.md). This snapshot is
independent of the visual [comparison result](./mokly-changes.md);
[removed previews](./mokly-removed-previews.md) owns baseline capture and delivery.

## Shared Metadata Contract

One package-internal catalogue-change module owns this typed snapshot and its
pure selection rules. The Git-backed loader supplies validated current and
baseline v8 manifests plus one resolved branch-point commit. Server, watcher,
preview capture, and publication consume the same
snapshot for a catalogue generation:

```ts
interface CatalogueChangeSnapshot {
  schemaVersion: 2;
  baseRef: string;
  baseCommit: string;
  changedEntries: readonly string[];
  movedEntries: readonly { path: string; previousPath: string }[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

interface RemovedEntrySnapshot {
  entry:
    | ManifestScreen
    | ManifestPage
    | ManifestDocument
    | ManifestComponent
    | ManifestComponentVariant;
  folderTitles: readonly string[];
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

The entry types are validated manifest-v8 DTOs, including their common metadata
and tags. A removed record carries no route: its URL and artifact names derive
from its path. `folderTitles` holds the baseline titles of its folders from the
top level down, resolved from the baseline manifest's folder records and index
pages under the [title rule](./mokly-folders.md#titles), independent of a
surviving current folder. A removed variant of either kind retains its baseline
`variantOf` and carries its parent's folder titles, so the shell can place its
Removed row under a surviving parent as the
[variant navigation contract](./mokly-variant-navigation.md) specifies; when the parent is also
removed, each is its own removed entry. `variantOf` is not a parallel snapshot
field; retaining the complete baseline DTO preserves it.

`changedEntries` is the sorted, unique union of affected current entry paths
and the selected removed-entry paths. `movedEntries` lists, sorted by current
path, every current entry the [move contract](./mokly-moves.md) paired with a
baseline entry; such an entry compares with that baseline entry and carries
`previousPath` in the read model. Current entry attribution keeps the existing
path-keyed metadata, material generated-output, and rendered-resource rules,
extended with a page's single document and a document's documents per scheme
and resources; folder titles are presentation and never attribution. Apply the
same paired ignore normalization to page and document documents. For pages,
documents, and catalogues without registered components, source paths,
dependency declarations and shared-impact matches alone do not add otherwise
unchanged entries. Component catalogues use the
[path evidence rule](./mokly-component-changes.md#dependencies-and-styles)
for screens, components and flows, unioned with material/metadata page and
document Changes. Screen impact
continues to propagate to use cases through their screen steps. Current display
metadata comes from the matching current catalogue; removed display metadata
comes from `removedEntries`. No removed-use-case support is introduced here.

Visual comparisons use [review result v5](./mokly-changes-serving.md#comparison-engine)
for every catalogue. Pages and documents add no comparison records. Neither
catalogue change detection nor page or document removal requires snapshot
generation. The publisher must not discover removed pages or documents by reading
`ReviewResult.screens`; that array remains the source of screen comparisons.
The shared catalogue snapshot drives its removed-entry pages, shell metadata,
and filter/search rows before HTML capture. It requires no additional public
endpoint or comparison JSON schema change.

## Removal Selection And Precedence

Removal is keyed by path for every kind: select a baseline screen, page,
document, component, or variant only when no current entry of any kind has its
path and the [move contract](./mokly-moves.md) paired it with nothing. A kind
change therefore yields one added current entry, never a simultaneous removed
record, and a paired baseline entry yields one current entry carrying
`previousPath`. The public reader rejects any model whose current entries and
`removedEntries` share a path, and a current variant cannot carry a `removed`
comparison state. Only records inside `removedEntries` are historical.

Ordinary removed entries sort by kind then path. If a removed variant's parent
survives, place the removed variant at the position its parent occupies in that
ordering and retain the baseline's authored sibling order among removed
variants. This is the same combined parent/variant projection the
[catalogue contract](./mokly-catalogue.md#serialization-identity-and-versions)
defines.

A removed variant of either kind follows these same selection and precedence
rules. Its relationship does not make it subordinate for selection: deleting
only the variant yields one removed entry, while deleting both parent and
variant yields one removed entry for each. A surviving parent does not claim
or suppress the variant's Removed row. Moving an entry between folders changes
its path; the move contract pairs it with its baseline, so it stays one entry,
labelled Moved, rather than a removal and an addition. Renaming a folder's
title changes no path and marks nothing.

Reject duplicate removed paths, invalid baseline metadata, and snapshots
whose current catalogue or baseline commit differs from the generation being
served or captured. A failed baseline read cannot become a successful empty
removal list. Preserve the runtime's unavailable-Git behavior and watch's
last-good generation. Invalid or missing history keeps existing command failure
rules; recognized earlier output follows the successful unavailable result in
the [baseline compatibility contract](./mokly-baseline-compatibility.md).

## Removed Page And Document Presentation

When Changes is selected, append removed pages and documents as flat root-level
leaf rows after the filtered current hierarchy, ordered by path. Reuse the
existing removed-screen row style, the page or document icon, and removed-row
identity; the visible label is `<title> · Removed`. There is no recreated
folder, historical folder, extra App root, or expandable Removed group.

A removed row's identity is `removed:<path>`. It is unique because a removed
record exists only while no current entry has that path.

Removed page and document rows are hidden from All; screen behavior is
unchanged. Removed variant placement, fallback, and order follow
[variant navigation](./mokly-variant-navigation.md). Search and tag filtering
use baseline path segments, title, and tags like current leaves. Changes counts
every selected removed entry and every paired moved entry once; home totals and
the tag picker use current entries.

The removed page or document view shows the baseline document from the same
snapshot, under the [removed previews](./mokly-removed-previews.md) contract.
Its details show the baseline title, path, description, tags, dependencies,
related docs, and folder titles. Historical titles are informational text,
not folder nodes or links that pretend the old hierarchy still exists.
Changing a surviving folder's title does not rewrite the baseline titles.
Keep the view available at `/view/<path>/` even when All is selected.

For example, removing the last entry in `Documents` leaves a flat
`Statement · Removed` row in Changes. Details retain its old `Documents` folder
title; neither navigation nor the home view recreates the old folder. Mockups
must cover this exact state at mobile and desktop widths before UI work begins.

## Watch And Publication

Recompute current impact, moved pairings, removed metadata, and baseline folder
titles together when watch replaces a validated generation, before notifying
the browser. Navigation,
counts, details, and previous-version views must never mix snapshots from
separate generations.
Publication with Changes uses the same snapshot and baseline commit as its
screen comparison capture, with safely escaped metadata in the captured shell.

The [publication option](./mokly-publication.md) defaults to current entries
only: no catalogue-change snapshot is computed or exported. With Changes
included, retain removed page and document rows, Moved rows, and
previous-version views from this model. Static delivery packages each removed
page or document preview and its historical resource closure in the comparison
generation; pages and documents still generate no visual comparison records.

## Acceptance

Use generic fixtures for removing a page or document and its now-empty ancestor
folders, renaming a surviving folder's title, reusing a path with another kind,
and moving an entry between folders with and without edits. Assert identical
removed metadata, `previousPath`, collision rejection, and counts in server,
watch, and opted-in publication; preserve screen comparison regression
coverage. Test filters/search, All versus Changes visibility, direct access to
a removed entry's `/view/<path>/` URL, baseline breadcrumbs, Moved rows, no
recreated folders, unavailable/malformed baselines, and zero Git/comparison
work for publication without Changes.

The validated serving/publication snapshot also retains component ownership
classification from the same pinned baseline. No-watch Serve and publication
reuse that evidence for every entry, including component variants; they
never retry or resolve a newer baseline while rendering the snapshot. Watched
component serving retains its generation-aware live cache.
