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
document keeps its own key handling. Besides the zoom keys of the canvas, the
frame forwards Escape and the shell's search keys: `/`, `⌘K` and Ctrl+K.
Decision: Escape and the search keys travel as `canvas-key` values, not as a
host listener on the frame's keys, because a host cannot read a cross-origin
frame's key events, and the canvas key forwarding already carries keys to the
host.

A keydown with Alt held does not qualify. A zoom key, Escape or `/` with Ctrl
or Command held does not qualify. A keydown whose target is an `input` of any
type, a `select`, a `textarea` or an element whose `isContentEditable` is true
does not qualify. Decision: `⌘K` and Ctrl+K do not qualify in an editable
element, not from anywhere as in the shell, because the frame cannot tell
whether the page binds them in its own fields.

| Input                                                 | Event `key` |
| ----------------------------------------------------- | ----------- |
| Shift with code `Digit0`                              | `zoom-100`  |
| Shift with code `Digit1`                              | `fit`       |
| Key `+` or `=`                                        | `zoom-in`   |
| Key `-`                                               | `zoom-out`  |
| Key `Escape`                                          | `escape`    |
| Key `/`                                               | `search`    |
| K with exactly one of Ctrl and Command, without Shift | `search`    |

Check the Shift and digit combinations first. On some layouts Shift+0 types
`=`. Shift does not stop Escape, nor `/`, which some layouts type with Shift.
A keydown is K when its `key` is `k` or `K`, or when its `key` is not a single
ASCII letter and its `code` is `KeyK`, as on a Cyrillic layout. Other keys send
no canvas key event.

Escape and the search keys also need the document to leave the keydown
unhandled: no listener in the document cancels it or stops its propagation
before it reaches the frame's window. Decision: Escape and the search keys
wait for the document's own handling, not precede it, because a page's own
dialog, menu or command palette can use the same keys. While a highlight or a
pick is active in the frame, Escape ends it under the
[pick rule](./mokly-frame-adapter.md#public-interface) and sends no `escape`.

A forwarded zoom key or Escape keeps its default action. A forwarded `search`
cancels its default action. While the subscription does not name `canvas-key`,
the frame forwards no key, and the search keys keep their default action.
Decision: the zoom keys keep their default action, not a cancelled one,
because outside an editable element they have no browser action. Decision: a
forwarded `search` cancels its default action, not keeps it as the other
canvas keys do, because `⌘K` and Ctrl+K start the browser's own search and `/`
opens a find bar in some browsers, as the shell's own search keys cancel
theirs. Escape keeps its default action, so that the page's own browser
behaviour for Escape, such as closing a native dialog, stays. The frame still
forwards such an Escape, because no listener handled it.

The viewer treats a forwarded `escape` or `search` from any canvas frame as the
same key pressed in the shell, under the
[canvas selection](./mokly-viewer-selection-canvas.md#clicks-by-tab) and the
[search keys](./mokly-shell-design.md#layout).

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
