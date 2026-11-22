# Frame Content Box

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).
It defines `contentBox()`, which measures the rendered content of the
document of a mounted frame. The viewer uses it to size a component's frame
to the component's document, under the
[canvas frames contract](./mokly-shell-device-chrome.md#canvas-frames).

## Measurement

`contentBox()` resolves with the content box of the mount's current
document. The content box is the smallest rectangle that holds every counted
box of the body's child nodes:

- An element child adds all of its client rectangles, which are its border
  boxes.
- A text child adds all of its client rectangles.
- An element child without client rectangles, such as an element with
  `display: contents`, adds its own child nodes under these rules.
- A comment adds nothing.

A box counts only when its width and its height are both greater than zero,
so collapsed whitespace adds nothing. The result is null when no box counts,
and when the document has no body.

The box is in unrounded CSS pixels, relative to the top left corner of the
document's initial containing block, and before host scaling. Scrolling the
document does not move it. Neither the viewport, nor a clipping ancestor, nor
occlusion cuts it. `x` and `y` are finite numbers from -1,000,000 to
1,000,000, and `width` and `height` are finite numbers from 0 to 1,000,000,
as the box bounds of the
[wire protocol](./mokly-frame-probe-wire.md#wire-protocol-v3) require. A
value outside these bounds rejects with `limit`. A result describes the
document when the adapter measured it.

## Usage And Adapters

The content box names no instance, so it needs no usage. It measures also
while the mount's usage is pending or unavailable. After disposal it rejects
with `disposed`. Its other failures reject as the other requests do. Both
built-in adapters implement `contentBox` and give the same result for the
same document. The cross-origin adapter measures through the
[`measure-content` request](./mokly-frame-probe-wire.md#wire-protocol-v4).
A custom adapter may omit `contentBox`.

Decision: the union of the body's children, not the border box of the root
element, because the root element always takes the viewport's width. A
narrow component then keeps its own width, and a comparison can compare the
widths of its two versions. Decision: one measurement for each request, not
a value that updates, because a frame that takes its size from its own
document could feed that size back into the document.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Frame probe handshake and wire protocol](./mokly-frame-probe-wire.md)
- [Frame probe](./mokly-frame-probe.md)
- [Shell device chrome](./mokly-shell-device-chrome.md)
