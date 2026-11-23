# Frame Box Model

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).

`boxModel(key)` measures one instance of the mount's ready usage, so that
Inspect can show the instance's size, padding and content size. It resolves
with the instance's box model, or with null when the instance has no single
element root or that element renders no box. An instance has a single element
root when it has exactly one range and that range holds exactly one element,
apart from comments and whitespace-only text.

`box` is the element's border box in CSS pixels, relative to the frame's
visible content viewport and before host scaling. Unlike the boxes of an
`InstanceBoundary`, clipping and occlusion do not cut it. `border` and
`padding` hold the element's border and padding widths on each side, in CSS
pixels. The content size is the size of `box` less the border and the padding
on each axis, and it is never less than zero. `box` follows the box bounds of
the [wire protocol](./mokly-frame-probe-wire.md#wire-protocol-v3), and each
side is a finite number from 0 to 1,000,000. A value outside these bounds
rejects with `limit`. A key outside the mount's ready
usage rejects with `missing-instance`, and unavailable usage rejects as the
other inspection requests do. A result describes the document when the adapter
measured it, so the viewer measures again after a `geometry` event.

Both built-in adapters implement `boxModel` and give the same result for the
same document. A custom adapter that omits it shows no box model, and the rest
of inspection stays available. Decision: the adapter reports these bounded
numbers, not computed styles or elements, because consumer content never
leaves the frame and the host validates every value it receives.
