# Viewer Frame Adapter

Status: `postMessageAdapter` takes no `access` or `onAccessFailure` option yet. The [Mokly start page, worker and relay milestone](../../plans/private-catalogue-embedded-access.md#milestone-7-mokly-start-page-worker-and-relay) adds them.

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
  canvasInput?: boolean;
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
  | {
      type: "canvas-wheel";
      deltaY: number;
      deltaMode: 0 | 1 | 2;
      x: number;
      y: number;
    }
  | { type: "canvas-pinch"; scale: number; x: number; y: number }
  | {
      type: "canvas-key";
      key: "zoom-in" | "zoom-out" | "zoom-100" | "fit" | "escape" | "search";
    }
  | { type: "canvas-focus"; visible: boolean }
  | { type: "canvas-blur" }
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
  contentBox?(): Promise<Box | null>;
  subscribe(listener: (event: FrameEvent) => void): () => void;
  dispose(): void;
}
interface FrameAdapter {
  mount(frame: HTMLIFrameElement, view: FrameMount): Promise<MountedFrame>;
}
declare function sameOriginAdapter(): FrameAdapter;
declare function postMessageAdapter(options: {
  frameOrigin: string;
  access?: () => Promise<{ token: string; expiresAt: number }>;
  onAccessFailure?: () => void;
}): FrameAdapter;
```

Current frames derive routes from `url` under `/static/mokly-generated/`; no prefix or route override exists.

Mount validation follows the [artifact path contract](./mokly-artifact-paths.md#frames-and-reverse-mapping).
A mount has no time limit while the frame's document loads. Until it settles,
each load gives it 5,000 ms to accept a document or get a reply, or it rejects
with `timeout`. A request without a reply in 5,000 ms rejects with `timeout`
and disposes the mount, so every later request rejects with `disposed`.
Decision: Serve renders pages on demand, so no fixed load limit fits.
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

The [frame adapter usage contract](./mokly-frame-adapter-usage.md) defines how
the usage of a frame gates its inspection, and how `updateUsage` replaces it.

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

`boxModel(key)` measures the box model of one instance. The
[frame box model contract](./mokly-frame-box-model.md) defines it.

## Content Box

`contentBox()` measures the rendered content of the mount's document, so
that the viewer can size a component's frame to it. The
[frame content box contract](./mokly-frame-content-box.md) defines it.

## Canvas Input

Set `canvasInput` to forward canvas input and focus from the frame's document.
The [frame canvas input contract](./mokly-frame-canvas-input.md) defines the
events and the subscription.

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
that the static build injects. The [frame access contract](./mokly-frame-access.md)
defines the `access` and `onAccessFailure` options, which open screens from a
frame host that needs a credential on every file.

## Related Docs

- [Frame package](./mokly-frame-package.md)
- [Frame access](./mokly-frame-access.md)
- [Frame adapter usage](./mokly-frame-adapter-usage.md)
- [Frame box model](./mokly-frame-box-model.md)
- [Frame canvas input](./mokly-frame-canvas-input.md)
- [Frame content box](./mokly-frame-content-box.md)
- [Same-origin frame documents](./mokly-frame-adapter-same-origin.md)
- [Frame probe handshake and wire protocol](./mokly-frame-probe-wire.md)
- [Frame probe](./mokly-frame-probe.md)
- [Frame link navigation](./mokly-frame-link-navigation.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
