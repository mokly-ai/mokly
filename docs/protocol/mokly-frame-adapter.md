# Viewer Frame Adapter

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

## Public Interface

The viewer exports these types. `CatalogueUsage` is the generated type of the
[usage records](./mokly-component-usage-records.md).

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
viewer, not the inspector protocol.

Boxes are finite CSS pixels relative to the frame's visible content viewport,
after internal scrolling, clipping ancestors and occlusion, before host scaling.
Widths/heights are nonnegative. Multi-root/text instances can have several
boxes per range; hidden/null ranges have empty arrays. Report all authenticated
instance boundaries, including empty ones, without invented geometry. Parent
code translates/clips boxes to the outer frame and host viewport. Geometry
changes invalidate measurements on scroll, resize, mutation and font/image load.
Both the same-origin measurer and in-frame inspector share clipping rules.
Viewport-fixed elements and their text escape ordinary overflow ancestors;
clipping resumes at a fixed-position containing block (including transforms,
perspective, filters, containment or relevant `will-change`). Inner scrollers
still clip their own descendants. Ancestor visibility and opacity remain
effective across a fixed-position escape. This follows the
[CSS containing-block model](https://www.w3.org/TR/css-position-3/#def-cb).
`scrollTo` scrolls the first rendered range into nearest view, including inner
scroll containers; null output is a successful no-op, an absent key is an error.

An adapter draws nothing in the host document or in the preview. Its
`highlight` sets the keys and the mode of its pick listeners. The shell
draws the mask and the labels of the
[highlight visuals](./mokly-component-explorer.md#highlight-components) with
components of the [shared UI package](./mokly-ui-package.md), from the boxes
of `listInstanceBoundaries()`. A cross-origin mask redraws after one message
round trip, as its labels do. Decision: the shell draws every mask, not an
adapter or the in-frame inspector, because each of those drawings is a second
implementation outside the shell's React tree.

Highlighting preserves consumer pixels/layout/styles, and `off` restores
normal link activation. Pick intercepts instance selection before product
links; Escape emits `pick-end`. Subscriptions share one installation and
return idempotent cleanup. Disposal removes listeners, observers and scheduled
work, rejects pending operations, and is idempotent. Host-side errors use the
codes above; diagnostics are not extracted from consumer text.

## Same-Origin Documents

A loaded document must retain the exact origin, query and decoded resource
path. A provider may canonicalize a final `.html` suffix to the otherwise
identical extensionless path; no other path redirect is accepted. The URL
fragment is client-only positioning rather than resource identity, so the
adapter authenticates the document first and then applies a missing or changed
validated fragment. An authenticated document reload renews every
document-scoped listener and observer without replacing the outer frame
session. Range authentication, including a component page's markerless root
region, follows the [range markers](./mokly-published-inspector.md#range-markers);
ownership, clipping, pick handling, scroll restoration and logical-link
classification match the inspector. Ready usage is required for instance
inspection; absent usage does not disable valid navigation.

While a same-origin replacement loads, valid marked activations in the
still-visible document stay host-owned only when a previous same-origin mount
authenticated that exact document for the frame. A document that no mount
authenticated, including one the frame reached through its own native
navigation, keeps portable native-link behavior until the replacement
authenticates. Document identity, not URL equality, decides this transfer:
scripts are disabled, so a document cannot change its resource identity, and
every frame navigation commits a new document.

Only the first same-origin mount of a frame may authenticate an already
rendered starting document whose resource exactly matches the assignment: the
document that the frame's initial `src` started loading. On every later mount,
a starting document that no earlier mount authenticated never passes
assigned-resource authentication, even when its URL exactly equals the new
assignment. Only a different replacement document may then pass the resource
check. A rejected starting document must trigger a fresh history-replacing
navigation even when both its URL and the iframe's `src` equal the assignment;
URL equality alone cannot justify reuse or waiting for a load that is not in
progress. This decision is independent of document readiness: rejected starting
documents and different assigned resources are replaced while loading or
interactive as well as after completion. Changing the assigned resource also
cancels any earlier navigation, even when the still-visible authenticated
document already matches the new choice. A delayed superseded response must
never overwrite the latest preview selection.

Authenticated matching documents and the matching document of the initial
`src` are reused without reloading; incomplete accepted documents wait only
for their own load completion. Only the first mount may wait for a
startup-assigned recorded fragment that has not committed yet.

The adapter authenticates the exact origin, decoded resource path and query of
the new immediate document as soon as that document becomes
same-origin-accessible. Host-owned navigation of the new document starts then,
so slower subresources that delay the iframe `load` event cannot delay it. A
previously authenticated identity never lets a transferred document satisfy a
new mount. Readiness installs inspection and geometry over the authenticated
document. Unsubscribing or disposing removes the receiver, so an unenhanced
document continues to use its portable native links.

The sandbox remains exactly `allow-same-origin`; consumer scripts stay disabled.
Historical [removed previews](./mokly-removed-previews.md) and
[comparison panes](./mokly-comparison-panes.md) bypass this adapter as guarded,
viewer-origin `srcdoc`; panes add only their documented scrolling behavior.
Local memory previews use their authenticated private transport.
No inspector handshake, extra badge, pick control, or visible affordance appears
locally. Panes gain no inspection, geometry, markers, or navigation messages.

## Cross-Origin Adapter

`postMessageAdapter` mounts a frame on a separate origin. The
[inspector handshake and wire protocol](./mokly-inspector-wire.md) define its
mount, its handshake with the in-frame inspector, and wire protocol v2. The
[published inspector contract](./mokly-published-inspector.md) defines the
in-frame inspector script that the static build injects.

## Related Docs

- [Inspector handshake and wire protocol](./mokly-inspector-wire.md)
- [Published inspector](./mokly-published-inspector.md)
- [Frame link navigation](./mokly-frame-link-navigation.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
