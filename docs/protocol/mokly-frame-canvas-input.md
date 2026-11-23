# Frame Canvas Input

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).

## Subscription And Adapters

A host sets `canvasInput: true` for each mount whose canvas needs these
events. Decision: the host opts in for each mount, not always, because a
non-passive wheel listener can delay scrolling, and a host without a canvas
keeps the browser's own zoom.

Both built-in adapters forward the same events while a listener is subscribed.
The events need no instance usage. The cross-origin adapter forwards them
through the [wire protocol](./mokly-frame-probe-wire.md#wire-protocol-v4).
Decision: forward the input, not a zoom value, because the canvas owns its
zoom, its limits and its speed.

The frame holds no wheel or gesture listener while the subscription names
neither `canvas-wheel` nor `canvas-pinch`. A wheel or gesture listener runs
while its event is named. Unsubscribing removes that listener and discards its pending input.
Disposal removes the listeners and cancels pending reports.

## Wheel And Pinch

`canvas-wheel` reports a wheel event with Ctrl or Command held. Most desktop
browsers also send a trackpad pinch as Ctrl with the wheel. A plain wheel
keeps its normal scrolling. Each forwarded wheel cancels its default action.

`deltaY` adds the signed vertical deltas of consecutive wheel events with
the same `deltaMode`. Mode 0 measures pixels, mode 1 measures lines, and mode
2 measures pages. When the mode changes, the earlier batch goes out first.
A batch whose sum is zero sends no event.

`canvas-pinch` reports the WebKit `gesturestart`, `gesturechange` and
`gestureend` events. They cover a trackpad pinch in Safari and a two-finger
pinch on iOS. While subscribed, the frame cancels the default action of each
gesture event. Each wheel or gesture continues to propagate.

WebKit's scale is cumulative from the start of the gesture. A gesture start
sets the baseline to its own scale. Each later event contributes its scale
divided by the preceding scale. The report's `scale` is the product of
those factors since the last report. A factor of exactly 1 sends no event.

Both reports carry `x` and `y` from the `clientX` and `clientY` of the last
input event in the batch. The coordinates are CSS pixels from the top left
of the frame's visible content viewport before host scaling. This matches
the coordinate space of instance boundary boxes. Decision: viewport
coordinates, not document coordinates, because the host cannot read a
cross-origin frame's scroll position. It maps a viewport point as it maps a
box.

The frame sends at most one wheel and one pinch report per animation frame
and at most 60 of each per second.

## Keys

`canvas-key` reports a keydown immediately, including a repeated keydown. The
frame leaves the key's default action in place. Decision: keys keep their
default action, not a cancelled one, because outside an editable element
they have no browser action. The document keeps its own key handling.

A key with Ctrl, Command or Alt held does not qualify. A keydown whose target
is an `input`, `select`, `textarea` or an element whose `isContentEditable` is
true does not qualify.

| Input                    | Event `key` |
| ------------------------ | ----------- |
| Shift with code `Digit0` | `zoom-100`  |
| Shift with code `Digit1` | `fit`       |
| Key `+` or `=`           | `zoom-in`   |
| Key `-`                  | `zoom-out`  |

Check the Shift and digit combinations first. On some layouts Shift+0 types
`=`. Other keys send no canvas key event.

## Focus

`canvas-focus` reports that the document holds focus. Its boolean `visible`
reports whether the active element matches `:focus-visible`. `canvas-blur`
reports that the document no longer holds focus.

Decision: the frame reports its focus, not the host page, because the host
page matches no focus rule while the frame's document holds focus.
Decision: `visible` follows `:focus-visible`, not the probe's own record of
the last input, because the browser's rule also covers focus that arrives
by Tab from the host page. The frame's focus glow follows the same rule as
the viewer's focus rings. A text field focused by the pointer also counts
as visible.

The frame reports focus while the subscription names `canvas-focus`. It sends
`canvas-blur` only while the subscription also names `canvas-blur`. A new
`canvas-focus` subscription reports the current state at the next animation
frame when the subscription names that state's event.

The frame reports a focus change at the next animation frame, within the rate
limit. Later reports require a change in whether the document holds focus or
shows focus. A move between two elements can produce a single report for the
final state. The frame sends at most one focus or blur report per animation
frame and at most 60 combined per second.

Focus reporting leaves focus and its default actions intact. Disposal ends
reporting. The host clears its focus state when it disposes or replaces
the mount.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Frame probe handshake and wire protocol](./mokly-frame-probe-wire.md)
- [Canvas pan, zoom and fit](./mokly-shell-canvas-stage.md#pan-zoom-and-fit)
