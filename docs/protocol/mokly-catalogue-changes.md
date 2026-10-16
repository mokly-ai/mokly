# Catalogue Change Metadata And Removed Pages

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

A base commit without the selected configuration file has an empty catalogue.
Every current entry is added. A malformed configuration or a failed Git read
keeps its validation or Git failure. A comparison size or command budget
makes Changes unavailable with a diagnostic naming the path and limit. The
current build remains usable.

## Shared Metadata Contract

The catalogue change snapshot v4 pairs the review result v8 of one comparison
generation with the base commit. The Rust core produces it from the catalogue
models of both sides under [Sides](./mokly-comparison.md#sides): the head
from the working tree, the base from the base commit. Serve, watch, the
static build, and publication consume the same snapshot for a generation:

```ts
interface CatalogueChangeSnapshotV4 {
  schemaVersion: 4;
  baseRef: string;
  baseCommit: string;
  changedEntries: readonly string[];
  movedEntries: readonly { path: string; previousPath: string }[];
  removedEntries: readonly RemovedEntrySnapshot[];
}

interface RemovedEntrySnapshot {
  entry: ScreenRecord | PageRecord | DocumentRecord | ComponentRecord;
  folderTitles: readonly string[];
  parentTitle?: string; // Required exactly on removed variants.
  snapshotId: string;
}
```

The snapshot and the review result of one generation share `baseCommit`. The
generated TypeScript types of the model crate are the normative shapes.

Serve computes the snapshot in the background after it listens and publishes
it with the Changes status as one revision under the
[shell delivery contract](./mokly-shell-delivery.md#updates-in-serve);
`build` computes it before it writes. A failed calculation omits the entire
Changes result, including removed entries, and the catalogue stays browsable.
On-demand comparisons use the accepted generation and its base commit.

The entry types are the [entry records](./mokly-component-manifest.md) of the
base commit's catalogue model, with their common metadata and tags. A removed
record carries no route: its URL and its document addresses derive from its
path. `folderTitles` holds the base titles of its folders from the top level
down, resolved from the base folder records and index pages under the
[title rule](./mokly-folders.md#titles), independent of a surviving current
folder. A removed variant keeps its base `variantOf`, its parent's folder
titles, and the parent's base title in `parentTitle`, captured before removal
selection, even when another kind reuses the parent's path. Non-variants omit
it. The [branch-point lookup](./mokly-branch-point-lookup.md#variant-parents)
owns parent resolution; [variant navigation](./mokly-variant-navigation.md)
owns placement. `snapshotId` is the removed record's identity in the
[catalogue index](./mokly-shell-delivery.md#catalogue-index) and in the
removed entry's detail under the comparison generation.

`changedEntries` is the sorted, unique union of the included current entry
paths and the selected removed-entry paths. `movedEntries` lists, sorted by
current path, every current entry the [move contract](./mokly-moves.md)
paired with a base entry; such an entry compares with that base entry and
carries `previousPath` in the read model. Membership follows the
[Changes membership](./mokly-comparison.md#changes-membership) rule: material
views under the canonical form, rule and resource evidence with owners,
reviewable metadata, and use cases whose steps name a changed screen. Pages
and documents compare their composed documents, per scheme for documents,
under the same materiality rule. Folder titles are presentation, never
attribution. Source paths, unreferenced files, and removed path declarations
neither add otherwise unchanged entries nor appear as evidence. Screens and
components use the
[component attribution contract](./mokly-component-changes.md). Current
display metadata comes from the current catalogue; removed display metadata
comes from `removedEntries`. There is no removed use case.

Visual comparisons use review result v8 for every catalogue. Pages and
documents add no comparison records, and their removal needs none. The static
build must not discover removed pages or documents by reading the review
entries. A page's CSS evidence travels as the `resourceEvidence` of its entry
detail.

## Removal Selection And Precedence

This section owns removal selection. Compare paths with case folding for
every kind: select a base screen, page, document, component, or variant only
when no current entry of any kind has its path and the move contract paired
it with nothing. A kind change therefore yields one added current entry,
never a simultaneous removed record, and a paired base entry yields one
current entry carrying `previousPath`. The index reader rejects any model
whose current entries and `removedEntries` share a case-folded path, and a
current entry cannot carry a `removed` comparison state. Only records inside
`removedEntries` are historical.

Ordinary removed entries sort by kind then path. Snapshot decoding rejects
unknown historical fields, duplicate snapshot identities, invalid parent-title
placement, and ordering established by the snapshot itself. Complete source
validation uses both catalogues to verify surviving-parent placement and base
authored variant order; this order is not inferred from variant path spelling. If a removed variant's
parent survives, place the removed variant at the position its parent
occupies in that ordering and keep the base's authored sibling order among
removed variants. This is the combined parent/variant projection of the
[catalogue contract](./mokly-catalogue.md#serialization-identity-and-versions).

A removed variant of either kind follows these same rules. Its relationship
does not make it subordinate for selection: deleting only the variant yields
one removed entry, while deleting both parent and variant yields one removed
entry for each. A surviving parent does not claim or suppress the variant's
Removed row. Moving an entry between folders changes its path; the move
contract pairs it with its base entry, so it stays one entry, labelled Moved,
rather than a removal and an addition. Renaming a folder's title changes no
path and marks nothing.

Reject duplicate removed paths, invalid base metadata, and snapshots whose
current catalogue or base commit differs from the generation being served or
built. A failed base read cannot become a successful empty removal list. An
unavailable Git repository keeps the runtime's unavailable behaviour, and
watch keeps its last good generation. A base whose sources fail current
validation makes Changes unavailable with those diagnostics.

## Removed Page And Document Presentation

When Changes is selected, append removed pages and documents as flat
root-level leaf rows after the filtered current hierarchy, ordered by path.
Reuse the removed-screen row style, the page or document icon, and removed-row
identity; the visible label is `<title> · Removed`. There is no recreated
folder, historical folder, extra App root, or expandable Removed group.

A removed row's identity is `removed:<path>`. It is unique because a removed
record exists only while no current entry has that path.

Removed page and document rows are hidden from All; removed screens stay
visible there. Removed variant placement, fallback, and order follow
[variant navigation](./mokly-variant-navigation.md). Search and tag filtering
use base path segments, title, and tags like current leaves. Home totals and the tag picker use current entries.

The removed page or document view shows the base document from the same
snapshot, under the [removed previews](./mokly-removed-previews.md) contract.
Its details show the base title, path, description, tags, related docs, and
folder titles. Historical titles are informational text, not folder nodes or
links that pretend the old hierarchy still exists. Changing a surviving
folder's title does not rewrite the base titles. Keep the view available at
`/view/<path>/` even when All is selected.

For example, removing the last entry in `Documents` leaves a flat
`Statement · Removed` row in Changes. Details keep its old `Documents` folder
title; neither navigation nor the home view recreates the old folder. The
design mockups cover this exact state at mobile and desktop widths.

## Changes Count

Changes counts the index records whose `changes.status` is `ready` and
whose `changes.included` is true:
current entries of every kind, screens, pages, documents, use cases, and
components, with each variant as its own entry; every selected removed record;
and every paired moved entry once, counted under `moved` as well. The shell
shows this count, and the terminal's `Changes ready` line reports the same
number with the moved count and the `ignored-only` diagnostic count beside it.
The ignored-only unit is an entry whose aggregate comparison state is
`ignored-only`; multiple views of that entry count once.
Instances, affected consumers, source-only edits, and ignored-only views never
enter the count.

## Watch And Publication

Recompute current impact, moved pairings, removed metadata, and base folder
titles together when watch replaces a generation, before Serve publishes the
revision. Navigation, counts, details, and previous-version views never mix
snapshots from separate generations. A static build with Changes uses the
same snapshot and base commit as its view comparisons, and the index carries
its metadata as data.

A build without Changes, under the option the
[publication contract](./mokly-publication.md) owns, computes no snapshot and
has no removed entries. With Changes included, the static build keeps removed
page and document rows, Moved rows, and previous-version views from this
model; it writes each removed entry's detail and its documents, with their
resource closure, into the comparison generation under
[removed previews](./mokly-removed-previews.md). Pages and documents still
generate no visual comparison records.

## Acceptance

Use generic fixtures for removing a page or document and its now-empty
ancestor folders, renaming a surviving folder's title, reusing a path with
another kind, and moving an entry between folders with and without edits.
Assert identical removed metadata, `previousPath`, collision rejection, and
counts in Serve, watch, and a build with Changes; keep screen comparison
coverage. Test filters and search, All versus Changes visibility, direct
access to a removed entry's `/view/<path>/` URL, base breadcrumbs, Moved rows,
no recreated folders, a base whose sources fail validation, and zero Git or
comparison work for a build without Changes. Serve and the static build reuse
one snapshot's ownership classification for every entry, including component
variants, and never resolve a newer base while they render that snapshot.
