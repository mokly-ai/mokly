# Comparison Pane Presentation

## Delivery Status

The [comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
delivers the presentation below: Milestones 2 and 3A the design references
listed at the end, Milestone 3 the generation-confined shared snapshot loader
and documented embedded fetch set, and Milestone 4 the aligned pane runtime.
Milestone 4 replaced the approved rule that sized each frame to its document
with device-sized frames driven by one shared scroller, recorded in the plan's
Decision 3, which awaits the user's confirmation. This contract governs the
Before and Current panes that
[Changes and screen comparisons](./mokly-changes.md) offer for changed screens
and eligible component variants in Side by side, Overlay and Difference. It
changes nothing about comparison eligibility, capture, generation, publishing,
current previews, or [removed previews](./mokly-removed-previews.md) beyond the
shared pipeline named here.

## Behavior

Overlay and Difference show both versions inside one device chrome and scroll
them as one: whatever the reader scrolls, both versions move together and
always show one offset, so the two can never drift apart. Side by side keeps a
chrome for each version, and scrolling one moves the other to the same offset.
Each version renders at the device's viewport size, so full-height sections,
fixed bars and sticky headers look as they do in Current. Inside a pane, links
and forms do nothing, an anchor moves both versions to its target, scroll keys
scroll the comparison, and text stays selectable. Readers compare a linked
screen through the catalogue, where every screen has its own comparison.
Loading, failed, refreshed, and renewed comparisons keep the existing product
copy, and Try again repeats the request. Individual browser expansion stays
available only in Current. No pixel counts or percentages are ever shown.

## Presentation

Serve, static export, and embedded viewers with either adapter use one
presentation path for every pane document. After the comparison JSON validates,
the viewer fetches every document the selected viewport and scheme need, for
both viewports when both are shown, before reporting ready. Each address must
be on the configured source origin beneath `snapshots/before/` or
`snapshots/after/` of the immutable generation the accepted comparison response
established: the directory of the redirected live `review.json`, or of the
pinned `comparisonUrl`. The GET carries the comparison's abort signal and uses
the comparison credential rule: `credentials: "omit"` for pinned delivery and
`credentials: "same-origin"` for live delivery.

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
and guard if the frame ever loads another document. A same-document anchor
moves the shared viewport to the target's document position instead of
scrolling inside the frame, and `:target` does not apply. Pane frames never
enter either frame adapter: no handshake, inspection, geometry, marker, or
navigation message exists for them, and the only privileges a pane gains are
same-origin measurement, programmatic scrolling, key forwarding and the guard.

Captured snapshot files, comparison JSON, packaged artifacts, and served bytes
stay byte-identical. The edits above exist only in the in-memory presentation.

## Scrolling

Each pane frame keeps the size of its chrome's viewport, so viewport units,
`position: fixed` and `position: sticky` resolve exactly as in Current, and a
document's size never depends on its frame beyond that fixed size. Sizing a
frame to its document was rejected: in Chrome a `min-height: 100vh` hero then
grew the frame from 1338 to 8136 pixels over twelve measurements without
converging, fixed bars moved to the end of the page and sticky headers stopped
sticking.

The chrome's viewport is the only user-scrollable container of its panes.
Inside it, a box that is `position: sticky` at the top-left and exactly the
viewport's size holds the frames, and a spacer after it extends the viewport's
range to the largest range of the section: its height is the largest
`scrollHeight − clientHeight` of the section's documents and its width the
viewport plus the largest `scrollWidth − clientWidth`. The viewport sets
`overflow-anchor: none`. A document is measured as soon as it commits, which
is one animation frame after its predecessor's window hides and before slow
resources let it load, and again when it loads; after it parses, or when a
parent-realm `ResizeObserver` on its root or body, a late resource, a font or a
`<details>` toggle reports a change, it is measured at the next animation
frame. Each measurement updates the spacers and applies the current offset
again. Because no frame size depends on its document, measuring cannot feed
back into it.

On every scroll of a viewport, the controller writes that offset to every
layer document of the section in the same handler, so the versions can never
disagree. A document shorter or narrower than the offset stops at its own end,
and its frame is translated by the remainder so its content stays aligned with
the offset; the uncovered area shows the layer's opaque surface, painted with
the document's canvas colour, read from its root's or else its body's computed
background, over the scheme's screen background. A scroll the controller did
not make itself, such as find in page, focus moving to an element, selection
autoscroll or a fragment target, is written back to the viewport, which then
applies one offset to every layer again. Loops are broken by comparing values,
never with timers: an event whose element already shows the offset last
written is an echo and is ignored.

Scroll keys pressed inside a pane, Space, Shift+Space, PageUp, PageDown, Home,
End and the arrow keys, move the pane's shared viewport: a page is 87.5% of the
visible height and an arrow key 40 pixels, as the browser steps. Keys stay with
editable targets, `input`, `textarea`, `select` and editable content, Space
stays with buttons and `<summary>`, and keys carrying Control, Meta or Alt are
left alone. Removed previews keep their own frame scrolling and guard.

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
reaches the top document, which cannot scroll, so the browser chains it to the
shared viewport. When both viewports are shown, the mobile and desktop sections
each have their own chrome, viewport and offset.

Side by side renders one chrome per version in the existing two-column grid,
each with one shared viewport holding one layer. Both viewports belong to one
section controller, so both spacers use the pair maximum and their ranges
always match, and the two offsets are mirrored in both directions with the same
value-based echo rule. Narrow layouts keep the existing single-column
responsive rules and the mirroring.

A pane whose document is missing, such as the current side of a removed
component variant, keeps the existing explicit missing-pane message and the
comparison falls back to Side by side, as it does today.

A document whose own inner regions scroll, such as a `height: 100vh;
overflow: hidden` root with scrolling children, keeps those regions independent
per layer: its document range is zero, the shared viewport cannot scroll, and
wheel input scrolls the inner region of the top layer only. Only document
scrolling is shared.

## Alignment Invariant

No comparison frame is ever user-scrollable, in any mode, viewport, scheme or
host. Every layer document of a section receives the section's one offset in
the handler that observed it, stopping at its own end with its frame shifted by
the remainder, so the content of every layer stays aligned at all times. The
two Side by side viewports show the same offset after any scroll settles.
Browser expansion is unavailable outside Current.

## Lifecycle

The comparison reports ready only when every selected pane document has an
accepted presentation, so a stack never appears with one layer missing; until
then the stage shows the existing loading copy and is busy. A fetch,
validation, read, parse, or presentation failure renders the existing “The
comparison could not be loaded.” copy with Try again, and its details show the
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
once a comparison is selected, under the existing CORS, `credentials: "omit"`,
`nosniff`, and `text/html` rules of the
[export delivery contract](./mokly-export-delivery.md). The documented host
CORS requirement already covers `__mokly/diffs/__generations/**`, so pane
documents need no new hosting rule. A `srcdoc` document inherits the embedding
document's Content Security Policy; an embedded host must allow the artifact
origin and generated inline styles for the resources a pane document needs.
No comparison document is fetched until a reader selects a diff mode. The
internal advertised-path model records this documented fetch set for regression
tests; it is not a runtime allowlist. The snapshot loader independently confines
each request to its immutable generation and configured sides.

## Acceptance

Regressions prove, through the selected and complete comparison paths in both
output modes:

- Wheel scrolling over an Overlay and a Difference stack puts both pane
  documents and the shared viewport at one offset with coincident layer
  rectangles, for desktop, mobile, both viewports at once, and a component
  comparison; the same spec failed before the implementation landed.
- Scrolling one Side by side viewport moves the other to the same offset in
  both directions, and an anchor in either pane moves both.
- Space, Shift+Space, PageUp, PageDown, Home, End and the arrow keys pressed
  inside a pane move the shared viewport; an input keeps its keys.
- A same-document anchor and a scroll the controller did not make move every
  version to one offset, and the shell URL and heading stay unchanged.
- A document shorter than its pair stops at its end, its frame is shifted by the
  remainder so its content stays aligned, and its surface shows its canvas.
- A `min-height: 100vh` hero keeps spacer and frame sizes stable across
  animation frames and after a late image loads, the spacer grows by exactly the
  image, fixed bars stay at the viewport's bottom and sticky headers at its top.
- Inner scroll regions stay independent per version, as documented.
- Every pane frame carries `data-mokly-comparison-frame`, exactly
  `sandbox="allow-same-origin"`, `scrolling="no"`, a `srcdoc`, and
  `data-mokly-preview-source` naming an address beneath the accepted
  generation; no pane loads a snapshot as its `src`.
- Plain, relative, external, and `mock:` links and forms inside a pane stay
  inert in every host, including while a slow resource holds back its load.
- Ready waits for every selected document; a rejected, redirected,
  other-origin, non-HTML, or oversized document renders the failure copy with
  a working Try again; Refresh presents the documents again.
- `after` addresses are accepted for comparison loaders and rejected for
  removed-preview loaders; other generations and prefixes are rejected.
- Snapshot files and comparison bytes are unchanged by presentation.

## Design References

The implemented design mockups depict this contract in both viewports, the
screen comparisons in both schemes and the component comparisons in Light like
every component design. `design-changes-overlay` at `design/review/controls/overlay.html`
depicts a short screen in Overlay inside one chrome, and
`design-changes-overlay-long` at `design/review/controls/overlay-long.html`
depicts a long screen scrolled part-way inside its shared chrome viewport, with
both layers at one offset, unchanged sections aligned, one reworded section
showing both versions, and the viewport's scrollbar drawn part-way down.
`design-review-difference` and `design-appearance-difference` depict Difference
with the same single-chrome stack over an opaque Before layer, and
`design-review-changed` and `design-appearance-side-by-side` depict Side by
side with one chrome per version. For component comparisons,
`design-component-overlay` and `design-component-difference` depict a saved
variant's two versions in one bordered component frame, and
`design-component-overlay-tall` depicts a component taller than that frame
scrolled part-way inside it, with both versions at one scroll position and the
frame's scrollbar drawn to match; `design-component-comparison` keeps one frame
per version in Side by side. Links inside every depicted pane are inert. See
[the shell design](./mokly-shell-design.md) and
[the component design](./mokly-component-design.md) for the complete tables.
