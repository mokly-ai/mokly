# Frame Adapter Usage

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).
It defines how the usage of a frame gates its inspection, and how a mounted
frame takes new usage.

## Inspection And Usage

Automatic inspection subscriptions require that frame's own ready, validated,
bounded usage. Pending or unavailable usage and usage limit failures still
allow navigation and opted-in canvas input. Ordinary pointer input then
triggers no hover or click measurement, geometry refresh, or instance event.
Both adapters share this rule. Explicit inspection requests still reject
unavailable usage.

## Usage Updates

Both built-in adapters implement optional `updateUsage` for validated evidence
on the same document. It clears that frame's old inspection state,
replaces the usage snapshot and updates its event subscription. A
pending/unavailable-to-ready update enables hover/click inspection without a
document load or new session. The reverse transition disables inspection.
Navigation and opted-in canvas input continue. The viewer calls `updateUsage`
when the URL, viewport, scheme and step stay the same. A custom adapter that
omits it receives a replacement mount
for changed usage. Updates reject after disposal and their failures retain
session cancellation ownership. `updateUsage` is a host-side method. The wire
protocol has no message for it.

When a frame's usage changes, the viewer invalidates its old inspection work.
It restores valid masks, outlines and host labels after the selected sessions
finish updating. Public highlights remain confined to their referenced frame,
including when a sibling is pending or updates independently. Every previously
referenced key must remain in ready usage; otherwise clear all current
presentation and end an active pick once with the viewer's `evidence` reason.
Pending pick activation is cancelled with `disposed` and no start/end event; a
fresh activation waits for the updated sessions. Unrelated updates do not
cancel or redraw inspection. Updates are ordered per session; superseded
success/failure has no current host effects. This coordination belongs to the
viewer, not the frame probe protocol.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Frame canvas input](./mokly-frame-canvas-input.md)
