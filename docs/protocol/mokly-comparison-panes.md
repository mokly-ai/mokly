# Comparison Pane Presentation

## Behavior

Overlay and Difference show both versions inside one device chrome; Side by
side keeps a chrome for each version. With Scroll together on, page scrolling
and paired inner panels move together under the
[scrolling contract](./mokly-comparison-scrolling.md), so versions cannot drift
where both have range. Each version renders at the device's viewport size, so
full-height sections, fixed bars, and sticky headers look as they do in
Current. Links and forms do nothing, anchors and scroll keys reach inner
regions before the page, and text stays selectable. Readers compare a linked
screen through the catalogue, where every screen has its own comparison.
Loading, failed, refreshed, and renewed comparisons keep the product copy,
and Try again repeats the request. Individual browser expansion stays
available only in Current. No pixel counts or percentages are ever shown.

## Presentation

Serve, the static build, and embedded viewers with either adapter use one
presentation path for every pane document. After the comparison JSON validates,
the viewer fetches every document the selected viewport and scheme need, for
both viewports when both are shown, before reporting ready. Each address must
be on the configured source origin beneath `snapshots/before/` or
`snapshots/after/` of the immutable generation the accepted comparison response
established: the directory of the redirected live `review.json`, or of the
pinned `comparisonUrl`. The GET carries the comparison's abort signal and uses
the comparison credential rule: `credentials: "omit"` for pinned delivery and
`credentials: "same-origin"` for live delivery.

The review result addresses panes by entry identity, view axes, and state. The viewer derives
each side's `snapshots/<side>/mokly-generated/<viewRoute(...)>` address from the entry's path,
`previousPath` on a [moved](./mokly-moves.md) entry's before side; no entry route
or snapshot path travels in comparison JSON.

Acceptance, parsing, and transformation follow the
[removed previews contract](./mokly-removed-previews.md#frames-and-lifecycle)
exactly: the final URL must be the requested address or its
provider-normalized extensionless form on the same origin, the status OK, the
MIME essence `text/html`, and the counted body at most 64 MiB. The body is
parsed without scripting; consumer `<base>` elements and `<meta http-equiv="refresh">`
directives are removed, one `<base href>` naming the effective base is
prepended, and the doctype and every other node are serialized unchanged. The
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

Captured snapshot files, comparison JSON, packaged artifacts, and served bytes
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

A stacked comparison, Overlay or Difference, renders exactly one device chrome
per viewport section: the browser chrome for desktop, the phone chrome for
mobile, and the bordered component frame for component comparisons. The shared
viewport fills the browser viewport below its bar, the phone screen below its
status band, or the bordered frame. Inside it the Before layer and the Current
layer are stacked at full size, and both paint an opaque screen background in
the selected scheme. The Current layer is the top layer, at 50% opacity in
Overlay and with CSS difference blending over the opaque Before layer in
Difference; the chrome is never blended. Wheel and touch input over the stack
reaches the top document. A movable inner region handles it there; otherwise
the non-scrollable frame lets the browser chain it to the shared page viewport.
When both viewports are shown, the mobile and desktop sections each have their
own chrome, viewport and offset.

Side by side renders one chrome per version in a two-column grid, each with
one page viewport holding one layer. Both viewports share the pair maximum
range of the [scrolling contract](./mokly-comparison-scrolling.md#page-scroller),
so their ranges always match. With Scroll together on, their page offsets and
paired inner regions mirror in both directions. With it off, each pane scrolls
independently. In the narrow layout, Side by side shows the two versions in
one column.

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
without restyling snapshot elements. Overlay and Difference always retain one
structural page offset; turning Scroll together off affects their inner regions,
not that shared page scrollbar. The scrolling contract defines every case.

## Alignment Invariant

No comparison frame is ever user-scrollable in any mode, viewport, scheme, or
host. With Scroll together on, every layer document receives its section's page
offset in the handler that observed it, and every paired inner region receives
both source offsets in that region's handler. Pages and regions clamp at their
own ends; only a shorter page's frame is translated, never snapshot elements.
Side by side offsets may differ only while the reader has explicitly turned
the control off. Overlay and Difference keep one page offset even then. Browser
expansion is unavailable outside Current.

## Lifecycle

The comparison reports ready only when every selected pane document has an
accepted presentation, so a stack never appears with one layer missing; until
then the stage shows “Loading comparison…” and is busy. A fetch, validation,
read, parse, or presentation failure renders “The comparison could not be
loaded.” with Try again, and its details show the
loader's “The comparison is unavailable.”; an embedded host also receives the
comparison error. Refresh and Try again fetch the comparison again and present
its documents anew.

Presentations are cached per address for one loaded comparison. Mode, viewport
and scheme switches keep that comparison and its cache, after live delivery
renews the generation as [selected comparisons](./mokly-selected-comparisons.md)
require, and present only documents not yet accepted. Current, route
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
