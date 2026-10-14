# Removed Content Previews

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Behavior

Opening a removed screen, page, or document shows its previous version: the
entry's views rendered from the base commit's sources under
[Sides](./mokly-comparison.md#sides), the same commit that produced its
Changes row. The heading keeps its Removed badge, breadcrumbs keep the textual
base ancestry, and Details keeps its historical metadata. A quiet label above
the stage reads “Showing previous version.” No Current selector, comparison
band, refresh control, Props editing, current inspector bindings, or current
usage or comment markers appear.

A removed page or document renders its historical document in the plain
document pane; a document's Light and Dark choices follow the historical
schemes that exist, and a page is light only. A removed document without a
historical dark version keeps its light version under Dark, and its label
reads `Showing previous version — Light only` when the catalogue has a dark
axis. A removed screen renders its historical mobile and desktop frames; Light
and Dark choices follow the historical views that exist. A saved scheme
without a historical view falls back to Light with the light-only note.
Removed screens stay outside comparison modes; an incoming comparison URL
opens the preview instead. A removed component entry has no preview: it
stays eligible for comparison with an explicit missing current side under
[variant navigation](./mokly-variant-navigation.md#changes-rows). An entry
the [move contract](./mokly-moves.md) pairs with a base entry is not removed
and has no preview; where its kind has a comparison, that comparison uses the
paired base entry as its before side.

A selected viewport with no historical view shows a note where its frame
would be, never a blank stage. The note reads “No previous mobile version was
captured. Switch to Desktop to see it.”, exchanging the two viewport names
for the desktop case. A preview with no views at all is unavailable instead,
so the viewport the note names always holds a view. Selecting both viewports
puts that view on the stage beside the note, so only the first sentence is
shown there. The note carries the `mbk-preview-note` class and its closing
sentence the `mbk-preview-switch` class, the classes the design catalogue's
stage stylesheet owns, and the second sentence is hidden rather than
rewritten while both viewports are selected.

Historical content is read-only in every host, including a viewer embedded
across origins. Scrolling, text selection, and same-document anchors work,
but the guard scrolls to anchors without changing the document URL, so
`:target` styling does not apply. Forms cannot submit, and every link is
inert: marked catalogue links, portable relative links, and external links do
nothing, so old links cannot open current content or leave the preview.
Historical documents keep the script-disabled sandbox and the external
resource policy of current documents; external HTTP(S) resources load as they
did, without offline copies.

The shell requests the preview when the removed entry is selected, in Serve
and in a static build alike. Ordinary browsing, All/Changes filtering,
search, navigation, and revision updates never request historical bytes.
While the request runs the stage reads “Loading previous version…”; a failure
shows “Previous version unavailable” with Retry while the catalogue stays
usable. Current bytes, current fragments, or invented content never stand in
for missing history. A build without Changes has no removed entries and
therefore no previews.

## Delivery

A removed entry's previous version is rendered from the base commit into the
comparison generation that the index's `comparisonUrl` names, and it is
delivered under the generation routes of the
[shell delivery contract](./mokly-shell-delivery.md#routes) together with the
removed entry's [detail](./mokly-shell-delivery.md#entry-detail) at
`mokly-viewer/diffs/generations/<generation>/entries/<path>.json`. That
detail carries `generation` and `snapshotId`, and its `views` list the
historical views that exist. Each historical document sits under the
generation's before side at the address the
[comparison pane contract](./mokly-comparison-panes.md) derives from the
entry path and the view axes: one document per historical view for a screen,
the light document for a page, and one document per scheme in the removed
record's `colorSchemes` for a document.

A removed screen's historical views are the `removed` views of its entry in
the generation's review result v8. Pages and documents have no comparison
record; their documents are delivered the same way. A removed page or
document also carries the removed preview metadata v3 at
`previews/<path>/index.json` inside the generation:

```ts
interface RemovedPagePreview {
  schemaVersion: 3;
  baseRef: string;
  baseCommit: string;
  path: string;
}
```

It names the entry's path and the base commit of the generation; readers
accept only version 3.

Serve answers the generation's before-side routes for a removed entry from
the render cache, where the background classification composed its base
views; a view evicted from the cache is recomputed from the same base inputs.
The generation's routes answer with `no-store`, `nosniff`, and GET/HEAD
parity. `build` writes every
removed entry's detail, documents, and preview metadata into the generation,
with the documents' transitive resource closure under the
[resources](./mokly-comparison.md#resources) rule, before installation. Those
files enter the deployment identity and the ownership inventory, and a
preview whose closure is incomplete fails the build. A build without Changes
writes no historical files and removes an installed artifact's historical
files when it replaces it. External HTTP(S) and data URLs stay external;
current files never replace historical bytes.

## Public Descriptor

The removed record of the [catalogue index](./mokly-catalogue.md) carries
`snapshotId` and the optional `preview` descriptor:

```ts
interface RemovedEntry {
  entry: CatalogueRecord;
  folderTitles: readonly string[];
  parentTitle?: string;
  snapshotId?: string;
  preview?: { kind: "screen" } | { kind: "page" } | { kind: "document" };
}
```

`snapshotId` is the opaque identity the
[catalogue contract](./mokly-catalogue.md#serialization-identity-and-versions)
defines. It selects the exact removed record and generation, and the removed
entry's detail repeats it. It is a selection key, not an authorization
capability, and grants no access to preview bytes. `preview.kind` states the
entry's kind for the preview; Serve and `build` both emit it when a
generation exists, and a removed component entry carries none.

Removed entries have no current files and no route field; their URL is
`/view/<path>/`, and historical HTML is never disguised as current output.
The descriptor contains no base metadata, source paths, or commit identifiers
beyond those public in the review JSON. Readers validate each `snapshotId` as
a unique lowercase 64-hex identity. Every removed record requires
`snapshotId` when `comparisonUrl` is non-null; readers never derive a missing
identity. With a null comparison URL, the field may be absent. Readers
validate `preview.kind`, tolerate an absent `preview`, and reject a preview on
a current entry or when `comparisonUrl` is null.

The viewer first resolves the selected snapshot and removed record from the
index, then fetches the removed entry's detail only from the advertised
generation, resolved against the source origin root for object and URL
sources, and accepts it under the
[fences](./mokly-shell-delivery.md#fetch-and-fences) of the shell delivery
contract. Validated views may then name a historical document only on that
source origin beneath the advertised generation's before-side directory. The
viewer never discovers the selected comparison endpoint, runs Git, or fetches
a removed entry's path as current output. A catalogue with
`comparisonUrl: null` shows the unavailable state without a request. Neither
frame adapter mounts a preview frame: previews are viewer-owned documents, so
no adapter handshake or inspection, marker, or navigation message exists for
them. Serve and the static build include the preview controller once in the
shell bundle; `@mokly/viewer` hosts use the same React components and request
lifecycle.

## Frames And Lifecycle

The fetch, acceptance, parsing, `srcdoc` presentation, link guard, and
late-response rules for a historical document follow the separate
[removed preview frame contract](./mokly-removed-preview-frames.md).

## Acceptance

See [removed preview acceptance](./mokly-removed-preview-acceptance.md).
