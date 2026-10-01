# Catalogue Change Metadata And Removed Pages

## Delivery Status

Implemented with [pages](./mokly-pages.md), variants, and publication. Catalogue
impact/removal metadata is independent of the visual
[comparison result](./mokly-changes.md); [removed previews](./mokly-removed-previews.md)
owns baseline documents and delivery descriptors.

## Shared Metadata Contract

One package-internal catalogue-change module owns this typed snapshot and its
pure selection rules. The Git-backed loader supplies validated current and
baseline v7 manifests plus one resolved branch-point commit. Server, watcher,
preview capture, and publication consume the same
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

The entry types are validated manifest-v7 DTOs, including their common metadata
and tags. A removed record carries no route: its URL and artifact names derive
from kind and id. It retains the baseline's root-to-parent `navPath` labels in
its entry DTO, independent of a surviving current folder. A removed variant of
either kind retains its baseline `variantOf` and its parent's `navPath`, so the
shell can place its Removed row under a surviving parent as the
[variant navigation contract](./mokly-variant-navigation.md) specifies; when the parent is also
removed, each is its own removed entry. `variantOf` is not a parallel snapshot
field; retaining the complete baseline DTO preserves it.

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
for every catalogue. Pages add no comparison records, and neither do docs
under the approved [docs contract](./mokly-docs.md). Neither catalogue change detection nor page removal requires snapshot
generation. The publisher must not discover removed pages by reading
`ReviewResult.screens`; that array remains the source of screen comparisons.
The shared catalogue snapshot drives its removed-entry pages, shell metadata,
and filter/search rows before HTML capture. It requires no additional public
endpoint or comparison JSON schema change.

## Removal Selection And Precedence

Removal is keyed by id for every kind: select a baseline screen, page,
component, or variant only when no current entry of any kind has its id. A kind
change therefore yields one added current entry, never a simultaneous removed
record. The public reader rejects any model whose current entries and
`removedEntries` share an id, and a current variant cannot carry a `removed`
comparison state. Only records inside `removedEntries` are historical.

Ordinary removed entries sort by kind then id. If a removed variant's parent
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
its `navPath`, not its id, so it stays one changed entry rather than a removal
and an addition.

Reject duplicate removed ids, invalid baseline metadata, and snapshots
whose current catalogue or baseline commit differs from the generation being
served or captured. A failed baseline read cannot become a successful empty
removal list. Preserve the runtime's unavailable-Git behavior and watch's
last-good generation. Invalid or missing history keeps existing command failure
rules; recognized earlier output follows the successful unavailable result in
the [baseline compatibility contract](./mokly-baseline-compatibility.md).

## Removed-Page Presentation

When Changes is selected, append removed pages, and removed docs, as flat
root-level leaf rows after the filtered current hierarchy, ordered by id.
Reuse the existing removed-screen row style, the page or doc icon, and
removed-row identity; the visible label is `<title> · Removed`. There is no recreated folder, historical folder,
extra App root, or expandable Removed group.

A removed row's identity is `removed:<id>`. It is unique because a removed
record exists only while no current entry has that id.

Removed-page rows are hidden from All; screen behavior is unchanged. Removed
variant placement, fallback, and order follow
[variant navigation](./mokly-variant-navigation.md). Search and tag filtering
use baseline id, title, and tags like current leaves. Changes counts every
selected removed entry once; home totals and the tag picker use current entries.

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

## Acceptance

Use generic fixtures for removing a page and its now-empty ancestor folders,
renaming a surviving folder, changing an id's kind, and moving an entry between
folders. Assert identical removed metadata, collision rejection, and counts in
server, watch, and opted-in publication; preserve screen
comparison regression coverage. Test filters/search, All versus Changes
visibility, direct access to a removed entry's derived URL, baseline
breadcrumbs, no recreated folders, unavailable/malformed baselines, and zero
Git/comparison work for publication without Changes.

The validated serving/publication snapshot also retains component ownership
classification from the same pinned baseline. No-watch Serve and publication
reuse that evidence for every entry, including component variants; they
never retry or resolve a newer baseline while rendering the snapshot. Watched
component serving retains its generation-aware live cache.
