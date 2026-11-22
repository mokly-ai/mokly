# Comparison Pane Presentation

Status: Compare on every frame of the canvas, Swipe, and Side by side on one chosen frame are not built yet. The [Canvas stage milestone](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds the canvas, and the [right panel and compare milestone](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds the comparisons on it.

## Behavior

Compare works on every frame of the
[canvas stage](./mokly-shell-canvas-stage.md): each shown frame compares its
own view. Overlay, Difference and Swipe show both versions inside each frame;
Side by side shows the two versions of one frame next to each other. With
Scroll together on, page scrolling and paired inner panels move together under
the [scrolling contract](./mokly-comparison-scrolling.md), so versions cannot
drift where both have range. Each version renders at its frame's viewport
size, so full-height sections, fixed bars, and sticky headers look as they do
in Current. Links and forms do nothing, anchors and scroll keys reach inner
regions before the page, and text stays selectable. Readers compare a linked
screen through the catalogue, where every screen has its own comparison.
Loading, failed, refreshed, and renewed comparisons keep the product copy,
and Try again repeats the request. Individual browser expansion stays
available only in Current. No count or percentage of changed pixels is ever
shown.

## Presentation

Serve, the static build, and embedded viewers with either adapter use one
presentation path for every pane document. Once the comparison's generation
is established, the viewer fetches every document that the shown frames need,
before reporting ready.
Each address must be on the configured source origin beneath
`snapshots/before/` or `snapshots/after/` of that immutable generation: the
root that the live selection redirected to, or the pinned `comparisonUrl`.
The GET carries the comparison's abort signal and uses the comparison
credential rule: `credentials: "omit"` for pinned delivery and
`credentials: "same-origin"` for live delivery. The standalone shell sends
`credentials: "same-origin"` for both, under the
[shell fetch rules](./mokly-shell-fences.md#fetch-and-fences).

The entry detail addresses panes by entry identity, view axes, and view
state. The viewer derives each side's
`snapshots/<side>/mokly-generated/<viewRoute(...)>` address from the entry's
path, and the before side from the detail's `before` path, which names a
[moved](./mokly-moves.md) entry's previous path; no entry route or snapshot
path travels in the index or the details.

Acceptance, parsing, and transformation follow the
[removed previews contract](./mokly-removed-previews.md#frames-and-lifecycle)
exactly: the final URL must be the requested address or its
provider-normalized extensionless form on the same origin, the status OK, the
MIME essence `text/html`, and the counted body at most 64 MiB. The body is
parsed without scripting; `<base>` elements and `<meta http-equiv="refresh">`
directives are removed, no `<base>` is added, relative addresses are replaced
with absolute ones resolved against the effective base, and the doctype and
every other node are otherwise serialized unchanged. The
result is assigned to `srcdoc`, never `src`, on a frame with exactly
`sandbox="allow-same-origin"`, no script permission and `scrolling="no"`, so
the document has the viewer's origin in every host while scripts, forms,
popups, downloads, top navigation and user scrolling of the frame stay
disabled. The frame carries `data-mokly-comparison-frame`, never the
removed-preview marker `data-mokly-preview-frame`, and
`data-mokly-preview-source` with the requested snapshot address. A `srcdoc`
document renders in no-quirks mode; both versions of a comparison share that
mode, so they stay comparable with each other even where one differs from its
original presentation, which is accepted.

The parent installs the read-only guard from the removed previews contract in
every pane document as soon as it commits, before slow resources let it load:
it cancels every link and form activation and reapplies the accepted `srcdoc`
and guard if the frame ever loads another document. A same-document anchor is
revealed under the [scrolling contract](./mokly-comparison-scrolling.md#anchors)
instead of navigating, so the shell URL and heading stay unchanged. `:target`
does not apply. Pane frames never enter either frame adapter: no handshake,
inspection, geometry, marker, or navigation message exists for them, and the
only privileges a pane gains are same-origin measurement, programmatic
scrolling, key forwarding, and the guard.

Captured snapshot files, the details, packaged artifacts, and served bytes
stay byte-identical. The edits above exist only in the in-memory presentation.

## Scrolling

The [comparison scrolling contract](./mokly-comparison-scrolling.md) owns frame
sizing, page ranges and measurement, instant writes, shorter-document
translation, value-based echoes, inner-region mirroring, keys, and anchors; the
[region pairing contract](./mokly-comparison-region-pairing.md) owns how regions
pair, and the [Scroll together contract](./mokly-comparison-scroll-together.md)
owns the reader preference. Sizing a frame to its document is rejected: it
distorts viewport units, fixed bars, and sticky headers and can feed a
document's height back into itself without converging.

## Layout

Every frame of the canvas compares its own view, at its own size and in its
own scheme, with its own viewport and page offset. A stacked comparison,
Overlay, Difference or Swipe, shows both versions inside the frame: one shared
viewport fills the frame, and the Before layer and the Current layer are
stacked at full size in it. Both layers paint an opaque screen background in
the frame's scheme. The Current layer is the top layer: at 50% opacity in
Overlay, with CSS difference blending over the opaque Before layer in
Difference, and shown only to the right of the divider in Swipe. Wheel and
touch input over the stack reaches the document that shows on top at that
point. A movable inner region handles it there; otherwise the non-scrollable
frame lets the browser chain it to the shared page viewport.

Swipe splits every frame at one vertical divider: the version before shows to
its left, and the current version to its right. The divider has a round grip
in the middle of its line, and a tag at the top on each side names its
version, Before and Current. Every frame draws the divider at the same place,
so a drag on any grip moves it on every frame. Swipe opens with the divider in
the middle. A focused grip moves with the arrow keys, and Home and End send it
to its ends. The grip and the tags keep their size at every zoom. Decision:
Swipe is a fifth mode and Overlay keeps its half-opacity view, rather than
Overlay becoming a divider, so that both ways to compare in one frame stay
available.

Side by side compares one frame at a time: the version before beside the
current version, each in its own frame, whose tag, Before or Current, comes
before its label. The frame chips of the
[Changes tab](./mokly-changes-controls.md#changes-tab) choose the compared
frame. It starts on the first shown frame, or on the picked frame in the
compact layout, whose frame picker picks another frame's pair. The canvas
shows the pair at the largest zoom that fits both versions. Decision: Side by
side shows one frame's pair, not every pair at once, because eight frames do
not fit a readable zoom. Both versions share the pair maximum range of the
[scrolling contract](./mokly-comparison-scrolling.md#page-scroller), so their
ranges always match. With Scroll together on, their page offsets and paired
inner regions mirror in both directions. With it off, each pane scrolls
independently.

A pane whose document is missing keeps an explicit message under its Before
or Current label, and the comparison falls back to Side by side. A missing
Before side reads “This screen did not exist before.”, and a missing Current
side, such as the current side of a removed component variant, reads “This
screen has been removed.”. A component comparison says “variant” in place of
“screen”: “This variant did not exist before.” and “This variant has been
removed.”. The `missing-before` and `missing-current` variants of
`design/library/preview/comparison-pane` and the removed Compact variant of
the component explorer depict this copy.

An app shell may keep a zero-range page while its panels scroll. Those inner
regions pair and mirror by authored name, id, role and accessible name, or a
conservative scored fallback. A shorter counterpart stops at its own end
without restyling snapshot elements. Overlay, Difference and Swipe always
retain one structural page offset in each frame; turning Scroll together off
affects their inner regions, not that shared page scrollbar. The scrolling
contract defines every case.

## Alignment Invariant

No comparison frame is ever user-scrollable in any mode, viewport, scheme, or
host. With Scroll together on, every layer document receives its frame's page
offset in the handler that observed it, and every paired inner region receives
both source offsets in that region's handler. Pages and regions clamp at their
own ends; only a shorter page's frame is translated, never snapshot elements.
Side by side offsets may differ only while the reader has explicitly turned
the control off. Overlay, Difference and Swipe keep one page offset in each
frame even then. Browser expansion is unavailable outside Current.

## Lifecycle

The comparison reports ready only when every selected pane document has an
accepted presentation, so a stack never appears with one layer missing; until
then the canvas shows “Loading comparison…” and is busy. A failed comparison
request, or a fetch, validation, read, parse, or presentation failure, renders
“The comparison could not be loaded.” with Try again. Its details show “The
comparison is unavailable.” for each of these failures. An embedded host also
receives the comparison error. Refresh and Try again fetch the comparison
again and present its documents anew.

Presentations are cached per address for one loaded comparison. Mode, compared
frame, viewport and scheme switches keep that comparison and its cache, after
live delivery renews the generation as
[selected comparisons](./mokly-selected-comparisons.md) require, and present
only documents not yet accepted. Current, route
replacement, evidence or source replacement, unmount, and a newly loaded
comparison, from Refresh, Try again or a renewal that found a new generation,
cancel pending work and discard the cache, so a late response can never present
a document in another screen's stack and presentations are never shared across
generations.

## Embedded Fetch Set

An embedded viewer may fetch, on the source origin, every path beneath the
advertised generation's `snapshots/before/` and `snapshots/after/` directories
once a comparison is selected, under the CORS, `credentials: "omit"`,
`nosniff`, and `text/html` rules of the
[static delivery contract](./mokly-export-delivery.md). The host CORS
requirement of that contract covers `mokly-viewer/diffs/generations/**`, which
holds the pane documents. A `srcdoc` document inherits the embedding
document's Content Security Policy; an embedded host must allow the artifact
origin and generated inline styles for the resources a pane document needs.
No comparison document is fetched until a reader selects a diff mode.

## Design References

The design catalogue depictions of every pane state, in both viewports and
schemes, are inventoried in
[comparison pane design references](./mokly-comparison-pane-designs.md).
