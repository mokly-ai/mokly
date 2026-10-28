# Comparison Scrolling

## Page Scroller

Each comparison frame stays exactly the size of its device viewport. Viewport
units, `position: fixed`, and `position: sticky` therefore resolve as in
Current, and a document's size never depends on its measured size. The chrome
viewport is the only page-level scroll container for its panes; inner regions
defined below remain scrollable in their own right. Frames carry
`scrolling="no"` and are scrolled only by the viewer.

The device-sized frames stay in place while their viewport scrolls. Each
viewport's scroll range is the section's largest document range: vertically
the largest `scrollHeight - clientHeight`, and horizontally the largest
`scrollWidth - clientWidth`. Side by side gives both viewports this pair
maximum, so their ranges match.

The viewer measures a document as soon as it commits, before slow resources
finish, and again on its `load`. It measures again when the document's root
or body changes size, a resource loads, fonts finish loading, or a `<details>`
element toggles. Measurement updates every viewport's range and reapplies the
current page offsets. No frame dimension depends on the result, so measurement
cannot feed back into the document. Every measurement discards the section's
region pairing results, including the no-match results.

## Page Writes And Echoes

Every viewport keeps its own page offset and writes it to each layer document it
holds in the same handler that observed it. With Scroll together on, Side by
side first mirrors its two chrome viewports in both directions; a stack always
has one viewport, so its layers always share one offset. The off behavior is
defined by the [Scroll together contract](./mokly-comparison-scroll-together.md).
Every page write is instant, regardless of CSS `scroll-behavior`.

A shorter or narrower document clamps at its own range. Its frame is translated
back by the unmet x and y remainder, without changing the snapshot document, so
content before its end stays aligned. The revealed surface uses the document
canvas color: the computed root background, or the body background when the
root is transparent, over the selected scheme's opaque screen background.

A document scroll the viewer did not make, including find in page, focus,
selection autoscroll, or fragment behavior, is written back to its chrome
viewport first and then applied under the current Scroll together mode.
Echoes are recognized by value, never by a timer. A scroller's last recorded
value is the x/y offset at which the last viewer write settled, or the offset
of its last source scroll. An event that reports exactly that value is ignored.
An event with a different value is a new source scroll.

## Inner Scroll Regions

An inner scroll region is an `Element`, other than the document's
`scrollingElement`, whose computed `overflow-x` or `overflow-y` is exactly
`auto` or `scroll`. Its x range is `max(0, scrollWidth - clientWidth)` and its y
range is `max(0, scrollHeight - clientHeight)`. A region scrolls on an axis
only when that axis has one of those overflow values and a positive range.

When a region scrolls for any reason, the viewer resolves one counterpart in
every other version of the same section under the
[region pairing contract](./mokly-comparison-region-pairing.md). A candidate
must scroll on every axis on which the source scrolls. A source that scrolls on
x and y therefore cannot pair with a y-only candidate; a y-only source may pair
with a candidate that also scrolls on x, and a source whose `overflow-x` is
`hidden` is y-only even when its content is wider. Both offsets are still
written together.

## Region Writes And Echoes

With Scroll together on, the handler of a region's scroll event writes both
source offsets to every accepted counterpart instantly. The browser clamps a
shorter region to its own x/y range. Never resize, translate, restyle, or move
snapshot elements to compensate, so versions may differ visibly past a shorter
region's end.

The browser may animate a source scroll over several frames, for example the
scroll that a scroll key starts. Each frame's scroll event reports a new
offset, so, with Scroll together on, every counterpart follows each frame,
clamped to its own range. A counterpart therefore stops no later than the
source: at the source's final offset, or earlier at the end of its own range.

The per-element echo rule is the page rule: an event equal to that element's
last recorded value, written by the viewer or scrolled by the reader, is
ignored; either coordinate differing makes it a new source. Nested regions
match and mirror independently. A horizontal scroll writes x and y in the same
handler just like a vertical scroll. A region with no counterpart scrolls alone
without error. An element whose overflow is not `auto` or `scroll` is not a
region, so a scroll the browser makes inside one, such as focus revealing it,
is not mirrored.

These rules apply to Side by side in both directions, every layer in Overlay
and Difference, the mobile and desktop sections independently when Both is
shown, and component comparisons. Regions never pair across viewport sections.

### Design Depictions

`design/changes/diff-controls/overlay-panel` depicts a 44px top bar (40px on phone) and a
148px desktop navigation column, or a phone tab bar below the panel, staying in
place while both versions' main panels sit part-way down at one offset. The
panel draws its own scrollbar and the zero-range page draws none.
`design/changes/diff-controls/side-by-side-apart` depicts the switch off, with each version
at a different position and its own scrollbar. Fixed row heights make every
drawn offset and thumb independent of text wrapping.

## Scroll Keys

Do not handle an already prevented or composing key event, a key carrying
Control, Meta, or Alt, any scroll key from `input`, `textarea`, `select`, or
editable content, or Space from a `button` or `summary`. Those cases retain
their delivered browser behavior.

For another scroll key, choose the starting node in this order: the focused
element when it is not the document root or body; otherwise the last connected
Element targeted by `pointerdown` in that pane document; otherwise none. Walk
from that element through its ancestors, inclusive, and choose the nearest
inner region whose overflow on the key's axis is `auto` or `scroll` and that can
still move in the key's direction:

| Keys                               | Direction test                  |
| ---------------------------------- | ------------------------------- |
| Space, PageDown, ArrowDown, End    | `scrollTop < vertical range`    |
| Shift+Space, PageUp, ArrowUp, Home | `scrollTop > 0`                 |
| ArrowRight                         | `scrollLeft < horizontal range` |
| ArrowLeft                          | `scrollLeft > 0`                |

For a right-to-left region, identified by its computed `direction`, replace the
table's horizontal tests: ArrowRight can move when `scrollLeft < 0`, and
ArrowLeft when `scrollLeft > -horizontal range`.

When such a region exists, do not prevent the key and do not move a page
viewport; the browser scrolls that region and its scroll events drive
[region mirroring](#region-writes-and-echoes). When none exists, prevent the
key and move the applicable chrome viewport: a page is 87.5% of its visible
height, an arrow is 40 CSS pixels, Home is zero, End is the range end, and
every result is clamped. The page write then follows the current Scroll
together mode.

## Anchors

The read-only guard still cancels a same-document anchor and never applies
`:target`. If its target is inside inner regions, collect its strict ancestor
regions and process them innermost first. At each step recompute the target
border box. The region's visible box starts at its border rect plus
`clientLeft`/`clientTop` and extends by `clientWidth`/`clientHeight`. If the
target starts before that box, or is larger than it, add the start-edge
difference to the region offset; otherwise, if it ends after the box, add the
end-edge difference; otherwise leave that axis unchanged. Scroll instantly and
mirror the settled offsets when Scroll together is on before processing the
next ancestor.

After the regions, move the source section's page viewport to the target's
current document position and apply that page offset under the current mode.
Horizontal page movement uses the same nearest-edge rule; vertical movement
aligns the target's top. With Scroll together on, every enclosing counterpart
follows before the page viewport moves.
