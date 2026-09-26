# Comparison Pane Presentation

## Delivery Status

The [comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
defines the presentation below; its Milestones 3 and 4 deliver it. This
contract governs the Before and Current panes that
[Changes and screen comparisons](./mokly-changes.md) offer for changed screens
and eligible component variants in Side by side, Overlay and Difference. It
changes nothing about comparison eligibility, capture, generation, publishing,
current previews, or [removed previews](./mokly-removed-previews.md) beyond the
shared pipeline named here.

## Behavior

Overlay and Difference show both versions inside one device chrome and scroll
them as one: whatever the reader scrolls, both versions move together and
always share one offset, so the two can never drift apart. Side by side keeps a
chrome for each version, and scrolling one moves the other to the same offset.
Inside a pane, links and forms do nothing, an anchor scrolls within the same
version, Space still scrolls, and text stays selectable. Readers compare a
linked screen through the catalogue, where every screen has its own comparison.
Loading, failed, refreshed, and renewed comparisons keep the existing product
copy, and Retry repeats the request. Individual browser expansion stays
available only in Current. No pixel counts or percentages are ever shown.

## Presentation

Serve, static export, and embedded viewers with either adapter use one
presentation path for every pane document. After the comparison JSON validates,
the viewer fetches every document the selected viewport and scheme need, for
both viewports when both are shown, before reporting ready. Each address must
be on the configured source origin beneath `snapshots/before/` or
`snapshots/after/` of the immutable generation the accepted comparison response
established. The GET carries the comparison's abort signal and uses the
comparison credential rule: `credentials: "omit"` for pinned delivery and
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
`sandbox="allow-same-origin"` and no script permission, so the document has the
viewer's origin in every host while scripts, forms, popups, downloads, and top
navigation stay disabled. The frame carries `data-mokly-preview-source` with
the requested snapshot address. A `srcdoc` document renders in no-quirks mode;
both versions of a comparison share that mode, so they stay comparable with
each other even where one differs from its original presentation, which is
accepted.

The parent installs the read-only guard from the removed previews contract in
every pane document on each load: it cancels every link and form activation,
scrolls a same-document anchor into view itself without applying `:target`,
keeps Space scrolling, and reapplies the accepted `srcdoc` and guard if the
frame ever loads another document. Pane frames never enter either frame
adapter: no handshake, inspection, geometry, marker, or navigation message
exists for them, and the only privileges a pane gains are same-origin
measurement and the guard.

Captured snapshot files, comparison JSON, packaged artifacts, and served bytes
stay byte-identical. The edits above exist only in the in-memory presentation.

## Sizing

A pane document never scrolls internally. After a presentation loads, the
parent reads the document element's `scrollHeight`, rounds it up to a whole
CSS pixel, and sets the frame to that height; a `ResizeObserver` on the
document element repeats the measurement whenever fonts, images, or the frame
width change it. Both layers of a stack take the taller of their two heights,
so the shorter document paints its own background below its content and the
layers share one box. The frame width is the chrome's viewport width for both
versions.

If a document cannot be measured, which an accepted `srcdoc` presentation never
produces, the frame keeps the chrome's default viewport height and interior
pointer scrolling is disabled, so alignment is never lost even when
measurement is.

## Layout

A stacked comparison, Overlay or Difference, renders exactly one device chrome
per viewport section: the browser chrome for desktop, the phone chrome for
mobile, and the bordered component frame for component comparisons. That
chrome's viewport, the phone screen below its status band, or the bordered
wrapper is the only scroll container. Inside it the Before layer and the
Current layer are stacked at full width; the Current layer is the top layer,
at 50% opacity in Overlay and with CSS difference blending over the opaque
Before base in Difference, in the screen background of the selected scheme.
Wheel and touch input over the stack reaches the top document, which cannot
scroll, so the browser chains the scroll to the shared viewport. When both
viewports are shown, the mobile and desktop sections each have their own
chrome and scroller.

Side by side renders one chrome per version in the existing two-column grid.
Each chrome viewport scrolls its own full-height frame, and a parent-side
listener mirrors `scrollTop` and `scrollLeft` between the two viewports in
both directions with a re-entrancy guard. Narrow layouts keep the existing
single-column responsive rules and the mirroring.

A pane whose document is missing, such as the current side of a removed
component variant, keeps the existing explicit missing-pane message and the
comparison falls back to Side by side, as it does today. Comparison frames
retain matching dimensions in every mode.

## Alignment Invariant

No comparison document ever scrolls internally, in any mode, viewport, scheme,
or host. Both layers of a stack share one scroll offset at all times because
they live in one scroll container at one height. The two Side by side viewports
report the same offset after any scroll settles. Browser expansion is
unavailable outside Current. Selecting Current, another mode, another
viewport, or another scheme discards the pane presentations along with the
comparison work they belong to, so a later response can never present a
document in another screen's stack.

## Lifecycle

The comparison reports ready only when every selected pane document has an
accepted presentation, so a stack never appears with one layer missing; until
then the stage shows the existing loading copy. A fetch, validation, read,
parse, or presentation failure renders the existing failure copy with Retry.
Refresh and Retry fetch the comparison again and present its documents anew.
Renewal before reusing a live generation, route replacement, evidence or source
replacement, unmount, and mode, viewport, or scheme changes cancel and discard
superseded work exactly as [selected comparisons](./mokly-selected-comparisons.md)
do. Presentations are cached per address within one loaded comparison and are
never shared across generations.

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
No comparison document is fetched until a reader selects a diff mode.

## Acceptance

Regressions must prove, through the selected and complete comparison paths in
both output modes and through both frame adapters:

- Scrolling over an Overlay and over a Difference stack with the wheel keeps
  both pane documents at a zero scroll offset and their layer rectangles
  coincident, for desktop, mobile, both viewports at once, and a component
  comparison; the same spec fails before the implementation lands.
- Scrolling one Side by side viewport moves the other to the same offset in
  both directions.
- Every pane frame carries exactly `sandbox="allow-same-origin"`, a `srcdoc`,
  and `data-mokly-preview-source` naming an address beneath the accepted
  generation; no pane loads a snapshot as its `src`.
- Plain, relative, external, and `mock:` links and forms inside a pane stay
  inert in every host, and a same-document anchor scrolls within the pane
  while the shell URL and heading are unchanged.
- Frames are sized to their documents, resized after late resources load, and
  both layers of a stack share the taller height.
- Ready waits for every selected document; a rejected, redirected,
  other-origin, non-HTML, or oversized document renders the failure copy with
  a working Retry; Refresh presents the documents again.
- `after` addresses are accepted for comparison loaders and rejected for
  removed-preview loaders; other generations and prefixes are rejected.
- Snapshot files and comparison bytes are unchanged by presentation.

## Design References

`design-changes-overlay` at `design/review/controls/overlay.html` depicts a
short screen in Overlay inside one chrome, and `design-changes-overlay-long`
at `design/review/controls/overlay-long.html` depicts a long screen scrolled
part-way inside its shared chrome viewport with both layers at one offset.
`design-review-difference` and `design-appearance-difference` depict Difference
with the same single-chrome stack, and `design-review-changed` and
`design-appearance-side-by-side` depict Side by side. See
[the shell design](./mokly-shell-design.md) for the complete table.
