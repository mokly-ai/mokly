# Removed Content Previews

## Delivery Status

The [removed content previews plan](../../plans/removed-content-previews.md)
delivered typed capture, the Serve generation lifecycle, consumer export,
repository preview, upload packaging, and the shared shell and viewer. The
[viewer-owned historical previews plan](../../plans/viewer-owned-historical-previews.md)
defines the host-independent presentation. Preview names derive from paths.
Document previews, their `Light only` note, and suppression for paired moves
are implemented. Nothing here changes ordinary
browsing, Added entries, changed-screen comparisons, or removed component
variants.

The note for a selected viewport with no captured historical view is fixed
here and depicted by the design catalogue's
[no-captured-view screen](./mokly-shell-design-inventory.md).

## Behavior

Opening a removed screen, page, or document shows the version from the pinned
Changes baseline: the same branch-point commit that produced its Changes row,
in committed or [derived](./mokly-derived-baselines.md) mode. The heading keeps
its Removed badge, breadcrumbs keep the textual baseline ancestry, and Details
keeps its historical metadata. A quiet label above the stage reads “Showing
previous version.” No Current selector, comparison band, refresh control, Props
editing, current inspector bindings, or current usage/comment markers appear.

A removed page or document renders its historical document in the plain
document pane; a document's Light and Dark choices follow the historical
schemes that exist, and a page is light only. A removed document without a
historical dark version keeps its light version under Dark, and its label
reads `Showing previous version — Light only` when the catalogue has a dark
axis. A removed screen renders its
historical mobile and desktop frames; Light and Dark choices follow the
historical views that exist. A saved scheme without a historical view falls
back to Light with the existing light-only note. Removed screens stay outside
comparison modes; incoming comparison URLs are declined as today. Removed
component variants keep their existing comparison behavior. An entry the
[move contract](./mokly-moves.md) pairs with a baseline entry is not removed
and has no preview; where its kind has a comparison, that comparison uses the
paired baseline entry as its before side.

A selected viewport with no captured historical view shows a note where its
frame would be, never a blank stage. The note reads “No previous mobile version
was captured. Switch to Desktop to see it.”, exchanging the two viewport names
for the desktop case. A preview carrying no views at all is unavailable
instead, so the viewport the note names always holds a view. Selecting both
viewports already puts that view on the stage beside the note, so only the
first sentence is shown there. The note carries the `mbk-preview-note` class and
its closing sentence the `mbk-preview-switch` class, the classes the design
catalogue's stage stylesheet owns, and the second sentence is hidden rather
than rewritten while both viewports are selected.

Historical content is read-only in every host, including a viewer embedded
across origins. Scrolling, text selection, and same-document anchors work, but
the guard scrolls to anchors without changing the document URL, so `:target`
styling does not apply. Forms cannot submit, and every link is inert: marked
catalogue links, portable relative links, and external links do nothing, so old
links cannot open current content or leave the preview. Historical documents
keep the script-disabled sandbox and existing external-resource policy;
external HTTP(S) resources load as they did, without offline copies.

The preview is requested when the removed entry is selected, in development and
in static delivery alike. Ordinary browsing, All/Changes filtering, search,
navigation, and evidence updates never request historical bytes. A served or
packaged shell arrives holding “Previous version unavailable” without a Retry
control, because a shell whose browser client never runs cannot honour that
action. The client's first update replaces that with “Loading previous
version…” and then with the previous version. A client-side failure returns to
“Previous version unavailable” with Retry while the catalogue stays usable.
Current bytes, current fragments, or invented content never stand in for
missing history. Catalogues published without Changes have no removed entries
and therefore no previews.

## Screens Reuse The Comparison

A removed screen's previous views are the `before` views of its existing
comparison. The comparison engine captures every baseline view at
`snapshotViewPath("before", ...)`, with its transitive
resources; the selected endpoint accepts a before-only entry, and
Changes-enabled exports package those files under the generation root. The
shell requests the selected comparison exactly as for a changed screen, using
the stable endpoint in development and `comparisonUrl` in static delivery, then
renders each `removed` view from `snapshotViewPath("before", ...)`.
Only views whose `state` is `removed` render; a response whose views carry an
`after` side for that entry is a stale or reused generation and is treated as
unavailable.
Review JSON, snapshot bytes, retention, renewal by HEAD, coalescing, capacity,
cancellation, invalidation, and shutdown follow the
[selected comparison contract](./mokly-selected-comparisons.md) unchanged.

## Page And Document Previews

Pages and documents have no comparison records, so a removed page or document
adds a page selection to the same generation lifecycle. The stable request is
`/__mokly/diffs/review.json?page=<path>`, naming the removed page's or
document's path, optionally with `refresh=1`. `page` is exclusive with `path`;
combining them, repeating it, or naming a path that is not a selected removed
page or document fails with the existing malformed-request or
missing-selection responses. The response redirects to
`/__mokly/diffs/__generations/selected-<uuid>/preview.json`, an immutable
generation served with `no-store` and `nosniff`, GET/HEAD parity, and the
existing file-map confinement:

```ts
interface RemovedPagePreview {
  schemaVersion: 3;
  baseRef: string;
  baseCommit: string;
  path: string;
}
```

The preview carries only the entry's path and serves pages and documents
alike. `snapshotDocumentPath("before", path, colorScheme)` names each
captured document below the generation root: the directory of the redirected
`preview.json` in development, or the directory of `comparisonUrl` in static
delivery. A page has its light document only; a document has one document per
scheme in the removed record's `colorSchemes`. Readers accept only version 3.

Capture reads the historical documents and its local closure through the pinned
`BaselineReader`, with the same Git, regular-file, batch, source-exclusion,
reserved-file and size rules as screen snapshots. The
[resource URL rule](./mokly-changes-serving.md#resource-url-classification)
keeps CSS `//` external and rejects non-portable HTML URLs; current files never
replace historical bytes. The entry must belong to the accepted
removed-entry snapshot of the generation being served; a snapshot from another
generation is rejected before capture. No baseline is rebuilt during an HTTP
request; unprepared derived evidence returns the existing retryable failure.
Page generations share the selected queue, 32-request bound, ten-second
deadline, 60-second idle retention, 64 MiB artifact and 128 MiB capacity bounds,
epoch invalidation, and shutdown draining.

Changes-enabled export, publish packaging, and repository preview capture every
removed page and document preview from the single pinned baseline before
installation and write it beside the comparison:

```text
__mokly/diffs/__generations/<generation>/review.json
__mokly/diffs/__generations/<generation>/previews/<path>/index.json
__mokly/diffs/__generations/<generation>/snapshots/before/<path>/index.html
__mokly/diffs/__generations/<generation>/snapshots/before/<path>/index.dark.html
```

The dark document exists only for a document with a historical dark scheme.
The file at `previewMetadataPath(path)` contains the same `RemovedPagePreview`
shape. Its files enter the generation content identity, ownership inventory,
reference validation, deployment hash, finalized ownership marker, and
content-addressed upload. A preview whose closure is incomplete fails the
export transactionally, as an incomplete screen snapshot does. Current-only
delivery writes no historical files and removes a previous artifact's
historical files when replacing it. Repository preview validates these files
with the same typed descriptor builder as consumer export, then adds the
resulting descriptor only to its captured static shell metadata. The
development server it captured remains unchanged.

## Public Descriptor

Catalogue v4 carries the optional preview descriptor on each removed entry:

```ts
interface RemovedEntry {
  entry: CatalogueRecord;
  folderTitles: readonly string[];
  snapshotId?: string;
  preview?: { kind: "screen" } | { kind: "page" } | { kind: "document" };
}
```

`snapshotId` is the opaque baseline/generation identity defined by the
[catalogue contract](./mokly-catalogue.md#serialization-identity-and-versions).
It selects the exact removed record and baseline generation. It is a selection
key, not an authorization capability, and grants no access to preview bytes.

`preview.kind: "screen"` states that the removed screen's comparison `before`
views are its preview; the viewer derives them from `comparisonUrl` with
`snapshotViewPath`. `preview.kind: "page"` and `preview.kind: "document"`
state that the entry's metadata uses `previewMetadataPath(path)` inside the
same generation directory as `comparisonUrl`, so the viewer derives that
location from the generation and the entry's path. Serve leaves `preview`
absent for pages and documents, because live page generations are selected
through the stable endpoint rather than a catalogue-wide pointer, and the
local shell keeps its private data.

Removed entries have no current files and no route field; their URL is
`/view/<path>/`, and historical HTML is never disguised as current output. The
descriptor contains no baseline metadata, source paths, or commit identifiers
beyond those already public in review JSON. Readers validate each published
`snapshotId` as a unique lowercase 64-hex identity. They tolerate its absence
and may derive it from an immutable `comparisonUrl` generation; an explicitly
published baseline-backed identity remains valid before a generation exists or
while `comparisonUrl` is null.

Preview validation is separate: readers validate `preview.kind`, tolerate
`preview` being absent, and reject a preview on current entries or when
`comparisonUrl` is null; the derived preview metadata path stays confined to
the advertised generation beneath `__mokly/diffs/__generations/**` by
construction. The shipped [v4 fixture](./fixtures/catalogue-v4.json) exercises
these descriptors.

The embedded viewer first resolves the selected snapshot and historical entry,
then loads preview metadata only from the advertised generation:
`comparisonUrl` for screens and `previewMetadataPath(path)` for pages and
documents, resolved against the source origin root for object and URL sources.
Validated
metadata may then name a historical document only on that source origin beneath
the advertised generation's `snapshots/before/` directory. It never discovers
`/__mokly/diffs/review.json`, runs Git, or fetches a removed entry's path as
current output. A catalogue without the field, or with `comparisonUrl: null`,
shows the unavailable state without a request. Neither frame adapter mounts a
preview frame. Previews are viewer-owned documents, so no adapter handshake or
inspection, marker, or navigation message exists for them.

Serve and static artifacts include the preview controller and comparison
validator once in `__mokly/client/react-shell.js`. Application-owned
`@mokly/viewer` roots use the same React components and request lifecycle.

## Frames And Lifecycle

The fetch, acceptance, parsing, `srcdoc` presentation, link guard, and
late-response rules for a historical document follow the separate
[removed preview frame contract](./mokly-removed-preview-frames.md).

## Acceptance

The required regression and presentation coverage follows the separate
[removed preview acceptance contract](./mokly-removed-preview-acceptance.md).
