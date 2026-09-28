# Comparison Pane Presentation

## Delivery Status

The [comparison pane scroll alignment plan](../../plans/comparison-pane-scroll-alignment.md)
delivered the presentation below through Milestone 4: the existing design
references, generation-confined snapshot loader, and device-sized pane runtime.
Its [scrolling contract](./mokly-comparison-scrolling.md) records the delivered
page scroller and inner-region mirroring, with the
[region pairing](./mokly-comparison-region-pairing.md) and
[Scroll together](./mokly-comparison-scroll-together.md) contracts, which
Milestone 6 depicts in the design catalogue and Milestone 7 delivered. This
contract governs the Before and Current panes that
[Changes and screen comparisons](./mokly-changes.md) offer for changed screens
and eligible component variants in Side by side, Overlay and Difference. It
changes nothing about comparison eligibility, capture, generation, publishing,
current previews, or [removed previews](./mokly-removed-previews.md) beyond the
shared pipeline named here.

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

Review v4 supplies only entry identity, view axes, and state. The viewer derives
each side's `snapshots/<side>/<viewRoute(...)>` address from kind and id; no
entry route or snapshot path travels in comparison JSON.

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
instead of navigating, and `:target` does not apply. Pane frames never enter
either frame adapter: no handshake, inspection, geometry, marker, or navigation
message exists for them, and the only privileges a pane gains are same-origin
measurement, programmatic scrolling, key forwarding, and the guard.

Captured snapshot files, comparison JSON, packaged artifacts, and served bytes
stay byte-identical. The edits above exist only in the in-memory presentation.

## Scrolling

The [comparison scrolling contract](./mokly-comparison-scrolling.md) owns frame
sizing, page spacers and measurement, instant writes, shorter-document
translation, value-based echoes, inner-region mirroring, keys, and anchors; the
[region pairing contract](./mokly-comparison-region-pairing.md) owns how regions
pair, and the [Scroll together contract](./mokly-comparison-scroll-together.md)
owns the reader preference. Sizing a frame to its document remains rejected:
it distorted viewport units, fixed bars, and sticky headers and could feed a
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

Side by side renders one chrome per version in the existing two-column grid,
each with one page viewport holding one layer. Both viewports belong to one
section controller, so both spacers use the pair maximum and their ranges
always match. With Scroll together on, their page offsets and paired inner
regions mirror in both directions. With it off, each pane scrolls independently.
Narrow layouts keep the existing single-column responsive rules.

A pane whose document is missing, such as the current side of a removed
component variant, keeps the existing explicit missing-pane message and the
comparison falls back to Side by side, as it does today.

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

Regressions prove the page items below in live Serve through the selected
comparison path (`tests/browser/comparison_alignment.spec.ts` and
`comparison_alignment_input.spec.ts`). Against a static export and an embedded
viewer through both frame adapters, `comparison_alignment_hosts.spec.ts` proves
stacked wheel alignment, frame attributes, inert links and anchors, and export
Side by side mirroring; the pane failure path runs embedded. The region, key,
anchor, and Scroll together items are proved by the five
`tests/browser/comparison_regions*.spec.ts` suites, which the scrolling,
region pairing, and Scroll together contracts name case by case. Unit tests
under `packages/viewer/tests/` cover the controllers.

- Wheel scrolling over an Overlay and a Difference stack puts both pane
  documents and the shared viewport at one offset with coincident layer
  rectangles, for desktop, mobile, both viewports at once, and a component
  comparison; the same spec failed before the implementation landed.
- With the default control on, scrolling one Side by side viewport moves the
  other to the same offset in both directions, and an anchor in either pane
  moves both.
- Space, Shift+Space, PageUp, PageDown, Home, End, and the arrow keys reach the
  nearest movable inner region first and otherwise move the applicable page
  viewport; editable and Space-activated controls keep their keys.
- A same-document anchor reveals enclosing regions innermost first and then
  the page; with Scroll together on, its paired counterparts follow while the
  shell URL and heading stay unchanged.
- A document shorter than its pair stops at its end, its frame is shifted by the
  remainder so its content stays aligned, and its surface shows its canvas.
- A `min-height: 100vh` hero keeps spacer and frame sizes stable across
  animation frames and after a late image loads, the spacer grows by exactly the
  image, fixed bars stay at the viewport's bottom and sticky headers at its top.
- Inner regions pair in the specified order and mirror both axes in every
  mode, viewport, and component comparison; unmatched and `off` regions scroll
  alone, and shorter counterparts clamp without snapshot restyling.
- Scroll together is placed, persisted, and session-scoped as specified; its
  off behavior and last-scrolled-version realignment are live and reload no
  pane.
- Every pane frame carries `data-mokly-comparison-frame`, exactly
  `sandbox="allow-same-origin"`, `scrolling="no"`, a `srcdoc`, and
  `data-mokly-preview-source` naming an address beneath the accepted
  generation; no pane loads a snapshot as its `src`.
- A document or host that asks for smooth scrolling still moves with the
  shared offset at once, in a stack and in Side by side.
- Links and forms inside a pane stay inert in Serve, a static export and an
  embedded viewer, including while a slow resource holds back its load.
- Ready waits for every selected document; a pane document that cannot be
  presented renders the failure copy, reaches an embedded host's error event,
  and recovers with Try again; Refresh presents the documents again; the
  loader's rejection of redirected, other-origin, non-HTML and oversized
  documents is covered by its unit tests.
- `after` addresses are accepted for comparison loaders and rejected for
  removed-preview loaders; other generations and prefixes are rejected.
- Snapshot files and comparison bytes are unchanged by presentation.

## Design References

The implemented design mockups depict this contract in both viewports, the
screen comparisons in both schemes and component comparisons in Light.
`design-changes-overlay` depicts a short Overlay and
`design-changes-overlay-long` a long screen part-way down its shared chrome, with
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
per version in Side by side. Links inside every depicted pane are inert.

`design-changes-overlay-panel` depicts an app-shell screen in Overlay whose top bar and navigation stay in
place while both versions' main panels sit part-way down at one position, with
the panel's own scrollbar drawn and no page scrollbar on the chrome's viewport.
`design-changes-side-by-side-apart` depicts Side by side with
Scroll together off, each version at its own place with its own scrollbar.
Every diff-mode screen design draws the Scroll together switch after its mode
group, on everywhere but that one, as the runtime does.
See [the shell design](./mokly-shell-design.md) and
[the component design](./mokly-component-design.md) for the complete tables.
