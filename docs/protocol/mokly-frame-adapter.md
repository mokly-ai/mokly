# Viewer Frame Adapter

Status: The `boxModel` method, its types and its measurement are not built yet. The [frame probe box model milestone](../../plans/canvas-redesign.md#milestone-10-frame-probe-box-model) builds them.

## Public Interface

The [frame package](./mokly-frame-package.md) defines these types and the
built-in adapters, and `@mokly/viewer` re-exports them. `CatalogueUsage` is the
generated type of the [usage records](./mokly-component-usage-records.md).

```ts
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface InstanceBoundary {
  key: string;
  ranges: readonly { id: string; boxes: readonly Box[] }[];
}
interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
interface InstanceBoxModel {
  box: Box;
  border: BoxSides;
  padding: BoxSides;
}
interface FrameMount {
  url: URL;
  usage: CatalogueUsage;
  signal?: AbortSignal;
  onEvent?: (event: FrameEvent) => void;
}
type NavigationTarget =
  | { kind: "self" | "top" | "parent" | "blank" }
  | { kind: "named"; name: string };
interface FrameNavigation {
  screenPath: string;
  fragment?: string;
  target: NavigationTarget;
  activation: "primary" | "modified" | "middle";
}
type FrameErrorCode =
  | "origin"
  | "timeout"
  | "unavailable"
  | "invalid-message"
  | "invalid-boundary"
  | "limit"
  | "missing-instance"
  | "disposed";
type FrameEvent =
  | { type: "hover"; key: string | null; boxes: readonly Box[] }
  | { type: "click"; key: string; boxes: readonly Box[] }
  | { type: "navigation"; navigation: FrameNavigation }
  | { type: "pick-end"; reason: "escape" }
  | { type: "geometry" }
  | { type: "error"; code: FrameErrorCode };
interface MountedFrame {
  updateUsage?(usage: CatalogueUsage): Promise<void>;
  listInstanceBoundaries(): Promise<readonly InstanceBoundary[]>;
  highlight(
    keys: readonly string[],
    mode: "off" | "highlight" | "pick",
  ): Promise<void>;
  scrollTo(key: string): Promise<void>;
  boxModel?(key: string): Promise<InstanceBoxModel | null>;
  subscribe(listener: (event: FrameEvent) => void): () => void;
  dispose(): void;
}
interface FrameAdapter {
  mount(frame: HTMLIFrameElement, view: FrameMount): Promise<MountedFrame>;
}
declare function sameOriginAdapter(): FrameAdapter;
declare function postMessageAdapter(options: {
  frameOrigin: string;
}): FrameAdapter;
```

Current frames derive routes from `url` under `/static/mokly-generated/`; no prefix or route override exists.

Mount validation follows the [artifact path contract](./mokly-artifact-paths.md#frames-and-reverse-mapping).
A mount or a request that gets no reply within 5,000 ms rejects with
`timeout`. A request timeout disposes the mount, so every later request
rejects with `disposed`.
Caller-approved query parameters are retained; no selectors or comparison paths
are accepted. Mount navigates with iframe history replacement semantics; the
React shell retains its initial portable `src` after an adapter takes ownership.
A ready same-origin document may be reused only after mount-scoped authentication
accepts it. A superseded same-origin load may arrive during that handoff; it
cannot fail or be adopted by the current mount, which remains pending for the
exact assigned resource. A load, view/scheme swap or disposal invalidates the
old session and its pending work; responses from it never update a new mount.
The React shell supplies `onEvent` before calling `mount`. A conforming adapter
records that receiver before it starts replacing an already-visible document.
Passing the same callback to `MountedFrame.subscribe` adopts this mount-time
subscription rather than installing a duplicate; the returned cleanup restores
ordinary subscription semantics. This closes the interval between React session
ownership and mount readiness without treating a loading frame as unenhanced.
Callers that omit `onEvent` retain the explicit post-mount `subscribe` interface.
An optional mount signal cancels both pending initialization and an active
session. Built-in adapters remove cancellation listeners on disposal. Viewer
cleanup also fences late custom-adapter results and disposes them immediately.
An inspection request applies only to the frames that it names. A sibling
frame's missing evidence cannot fail a scoped request, and the viewer does not
await pending unrelated mounts. The viewer clears an unrelated mounted frame
with `highlight([], "off")`, which requires no available usage.
`listInstanceBoundaries()` supplies the masks, the labels, and marker
placement. A failed highlight removes its partially applied masks and labels.
After a replacement, obsolete caller promises reject with `disposed`, including
when a custom adapter settles late. Obsolete refreshes and errors cannot change the
replacement's picking, labels or host events. A geometry event that arrives
while host presentation activates or a measurement runs causes one trailing
refresh of the current session. It starts no competing boundary list and is
not lost behind a stale result.

Automatic inspection subscriptions require that frame's own ready, validated,
bounded usage. Pending/unavailable usage (or a usage limit failure) subscribes
only to navigation: no hover/click measurements, geometry refreshes or instance
events are triggered by ordinary pointer input. Both adapters share this rule;
explicit inspection requests still reject unavailable usage normally.

Both built-in adapters implement optional `updateUsage` for validated evidence
on the same document. It clears that frame's old inspection state,
replaces the usage snapshot and updates its event subscription. A
pending/unavailable-to-ready update enables hover/click inspection without a
document load or new session; the reverse transition disables it while preserving
navigation. The viewer calls `updateUsage` when the URL, viewport, scheme and
step stay the same. A custom adapter that omits it receives a replacement mount
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

Boxes are finite CSS pixels relative to the frame's visible content viewport,
after internal scrolling, clipping ancestors and occlusion, before host scaling.
Widths/heights are nonnegative. Multi-root/text instances can have several
boxes per range; hidden/null ranges have empty arrays. Report all authenticated
instance boundaries, including empty ones, without invented geometry. Parent
code translates/clips boxes to the outer frame and host viewport. Geometry
changes invalidate measurements on scroll, resize, mutation and font/image load.
Both built-in adapters run one event runtime and one set of clipping rules,
under the [frame package contract](./mokly-frame-package.md#built-in-adapters).
`scrollTo` scrolls the first rendered range into nearest view, including inner
scroll containers; null output is a successful no-op, an absent key is an error.

An adapter draws nothing in the host document or in the preview. Its
`highlight` sets the keys and the mode of its pick listeners. The shell
draws the mask and the labels of the
[highlight visuals](./mokly-component-explorer.md#highlight-components) with
components of the [shared UI package](./mokly-ui-package.md), from the boxes
of `listInstanceBoundaries()`. A cross-origin mask redraws after one message
round trip, as its labels do. Decision: the shell draws every mask, not an
adapter or the frame probe, because each of those drawings is a second
implementation outside the shell's React tree.

Highlighting preserves consumer pixels/layout/styles, and `off` restores
normal link activation. Pick intercepts instance selection before product
links; Escape emits `pick-end`. Every adapter follows the hover rule of the
[selection contract](./mokly-viewer-selection.md#selection-events-and-imperative-use):
`hover` names the instance that a `click` at the same point would report.
While the latest `highlight` call holds mode `highlight` or `pick`, hover and
click report only its keys; in mode `off`, they report any instance. Of nested
reportable instances under the pointer, the innermost wins. Subscriptions
share one installation and return idempotent cleanup. Disposal removes
listeners, observers and scheduled work, rejects pending operations, and is
idempotent. Host-side errors use the codes above; diagnostics are not
extracted from consumer text.

## Box Model

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

## Same-Origin Documents

`sameOriginAdapter` mounts documents on the viewer's origin. The
[same-origin frame documents](./mokly-frame-adapter-same-origin.md) contract
defines how it authenticates, reuses and replaces them, and which viewer-owned
documents bypass it.

## Cross-Origin Adapter

`postMessageAdapter` mounts a frame on a separate origin. The
[frame probe handshake and wire protocol](./mokly-frame-probe-wire.md) define
its mount, its handshake with the frame probe, and its wire protocol. The
[frame probe contract](./mokly-frame-probe.md) defines the frame probe script
that the static build injects.

## Related Docs

- [Frame package](./mokly-frame-package.md)
- [Same-origin frame documents](./mokly-frame-adapter-same-origin.md)
- [Frame probe handshake and wire protocol](./mokly-frame-probe-wire.md)
- [Frame probe](./mokly-frame-probe.md)
- [Frame link navigation](./mokly-frame-link-navigation.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
