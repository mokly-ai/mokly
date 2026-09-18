# Viewer Frame Adapter

## Delivery Status

Implemented in `@mokly/viewer` through [viewer library Milestones 4–5](../../plans/mokly-viewer-library.md). Local
Serve/export keep today's same-origin sandbox and visible behavior. Only an
explicit cross-origin host uses the new inspector transport. Host marker
consumption and the trailing geometry refresh are implemented by the
[comment anchoring plan](../../plans/viewer-comment-anchoring.md); the adapter
interface and wire protocol remain unchanged.

## Public Interface

The viewer exports these types; `CatalogueUsage` follows the [read model](./mokly-catalogue.md).

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
}
type NavigationTarget =
  | { kind: "self" | "top" | "parent" | "blank" }
  | { kind: "named"; name: string };
interface FrameNavigation {
  id: string;
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

Each mount owns one immediate viewer-created frame and its current URL/usage.
The host supplies the selected catalogue view URL; the adapter confines it to
current `/static/` HTML paths, the configured origin and a valid logical hash.
Caller-approved query parameters are retained; no selectors or comparison paths
are accepted. Mount replaces the document with iframe history
replacement semantics. A load, view/scheme swap or disposal invalidates the old
session and its pending work; responses from it never update a new mount.
An optional mount signal cancels both pending initialization and an active
session. Built-in adapters remove cancellation listeners on disposal. Viewer
cleanup also fences late custom-adapter results and disposes them immediately.
Viewer inspection selects sessions from the typed request before awaiting
readiness or calling boundary/scroll operations. Clearing an unrelated mounted
frame uses `highlight([], "off")`, which requires no available usage; pending
unrelated mounts are not awaited. Masks, package labels, host markers and
geometry refreshes use the same selected sessions, so a sibling's missing
evidence cannot fail a scoped request. `listInstanceBoundaries()` supplies both
labels and marker placement; current highlight failures remove partially applied
masks and labels.
Host inspection work retains request/generation ownership through both success
and rejection, including custom adapters that settle after replacement. Obsolete
caller promises reject with `disposed`; obsolete internal refreshes and errors
cannot change replacement picking, labels or host events. No wire fields change.
Geometry received while host presentation is activating or measurement is in
flight marks one trailing refresh on the current session generation. It does not
start a competing boundary list or lose an invalidation behind a stale result.

Automatic inspection subscriptions require that frame's own ready, validated,
bounded usage. Pending/unavailable usage (or a usage limit failure) subscribes
only to navigation: no hover/click measurements, geometry refreshes or instance
events are triggered by ordinary pointer input. Both adapters share this rule;
explicit inspection requests still reject unavailable usage normally.

Both built-in adapters implement optional `updateUsage` for validated evidence
on the same document. It clears that frame's old inspection presentation,
replaces the usage snapshot and updates its existing event subscription. A
pending/unavailable-to-ready update enables hover/click inspection without a
document load or new session; the reverse transition disables it while preserving
navigation. The viewer's frame update path uses this capability for unchanged
URL/viewport/scheme/variant/step identities; custom adapters that omit it retain
replacement-mount behavior for changed usage. Updates reject after disposal and
their failures retain session cancellation ownership. This is a host-side method;
the existing wire `subscribe` event set, schemas and inspector script are unchanged.

The viewer's inspection owner handles each changed usage snapshot before its
asynchronous adoption. It invalidates old inspection work, then restores valid
masks, outlines and host labels after the selected sessions finish updating.
Public highlights remain confined to their referenced frame, including when a
sibling is pending or updates independently. Every previously referenced key
must remain in ready usage; otherwise clear all current presentation and end an
active pick once with the viewer's `evidence` reason. Pending pick activation is
cancelled with `disposed` and no start/end event; a fresh activation waits for
the updated sessions. Unrelated updates do not cancel or redraw inspection.
Updates are ordered per session; superseded success/failure has no current host
effects. This coordination belongs to the viewer, not the inspector protocol.

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

Highlighting uses the [existing visuals](./mokly-component-explorer.md#highlight-components),
preserves consumer pixels/layout/styles, and restores normal link activation
when off. Pick intercepts instance selection before product links; Escape emits
`pick-end`. Subscriptions share one installation and return idempotent cleanup.
Disposal removes overlays, listeners, observers and scheduled work, rejects
pending operations, and is idempotent. Host-side errors use the codes above;
diagnostics are not extracted from consumer text.

## Same-Origin Implementation

`sameOriginAdapter` moves today's `contentDocument` access behind this interface:
[`component_geometry.ts`](../../packages/viewer/src/client/component_geometry.ts), range-node
and occlusion helpers, `component_highlight.ts`, `frame_navigation.ts`, and
the frame access in Browse state and workspace preview/controls. Preserve URL,
immediate-document, ownership and range authentication, clipping, highlighting,
scroll restoration and logical-link classification unchanged. Ready usage is
required for instance inspection; absent usage does not disable valid navigation.

The sandbox remains exactly `allow-same-origin`; consumer scripts stay disabled.
Existing local memory previews retain their authenticated private transport.
No inspector handshake, extra badge, pick control, or visible affordance appears
locally. Unsupported/unowned documents and comparison snapshots gain no privilege.

## Cross-Origin Mount And Handshake

`frameOrigin` is required: a canonical serialized HTTP(S) origin with no path,
query, fragment, userinfo, or opaque `"null"` value. It must differ from the
app origin and equal the view URL's origin. Reject `file:`, `data:`, `srcdoc`,
opaque frames and redirects to another origin. Set exactly
`sandbox="allow-same-origin allow-scripts"`; grant no forms, popups, downloads
or top-navigation token. The frame must be hosted on a separate origin from
the app. `allow-scripts` enables document scripts as a browser capability;
it cannot selectively authorize only Mokly's script. The local adapter never
adopts this policy. Content hosting/isolation remains the host's responsibility.

On each mount, generate 128 random bits using `crypto.getRandomValues` and
encode them as 32 lowercase hex characters. Set one `mokly-host` query parameter
to the app's exact serialized origin, using URL query encoding; preserve the
view's validated hash and other approved parameters. The inspector requires
exactly one valid HTTP(S) host-origin parameter distinct from its own origin.
The static host must ignore queries for file lookup. Never derive trust from
`document.referrer`, a message-supplied origin, or a wildcard.

After load, the adapter sends `hello` to the exact `frameOrigin`. The inspector
accepts it only from `event.source === window.parent` and
`event.origin === expectedHostOrigin`; it pins the first accepted nonce for
that document and replies `ready` to that exact origin. Duplicate hello with
the same nonce may resend ready; another nonce cannot replace the session.
The adapter accepts replies only when
`event.source === frame.contentWindow`, `event.origin === frameOrigin`, and
channel, version and nonce match its active mount. Both sides use exact
`targetOrigin` for every `postMessage`, never `"*"`. No `window.top` or
`parent.location` reads/writes occur. The inspector is inert without handshake:
no overlays, navigation interception, geometry collection or outgoing messages.
Only its bounded handshake listener exists before activation.

Ready/requests time out after five seconds, disposing the session without retries.
Disposal/unload clears all work; a fresh mount loads a new document and nonce.
At most 16 requests are pending.

## Wire Protocol v1

Every message is a JSON string of at most 262,144 UTF-8 bytes; reject nonstrings
or oversized strings before JSON parsing. The exact envelope is
`{ channel: "mokly-inspector", version: 1, nonce, type, ...fields }`.
All objects must be plain JSON objects with exactly the fields for their
discriminant; reject unknown keys recursively, unsupported versions/types,
duplicates in key/range arrays, invalid numbers and broken references. Do not
coerce strings to numbers or accept DOM nodes, transferable ports or binary data.

All types/fields follow; `H` is the host adapter, `F` the immediate inspector.

| Type         | Direction | Additional fields                                                                                         |
| ------------ | --------- | --------------------------------------------------------------------------------------------------------- |
| `hello`      | H → F     | none                                                                                                      |
| `ready`      | F → H     | none                                                                                                      |
| `list`       | H → F     | `requestId`                                                                                               |
| `boundaries` | F → H     | `requestId`, `boundaries: InstanceBoundary[]`                                                             |
| `highlight`  | H → F     | `requestId`, `keys: string[]`, `mode: "off" \| "highlight" \| "pick"`                                     |
| `scroll-to`  | H → F     | `requestId`, `key`                                                                                        |
| `subscribe`  | H → F     | `requestId`, `events: ("hover" \| "click" \| "navigation" \| "pick-end" \| "geometry")[]`                 |
| `ack`        | F → H     | `requestId`                                                                                               |
| `hover`      | F → H     | `key: string \| null`, `boxes: Box[]`                                                                     |
| `click`      | F → H     | `key`, `boxes: Box[]`                                                                                     |
| `navigation` | F → H     | `navigation: FrameNavigation`                                                                             |
| `pick-end`   | F → H     | `reason: "escape"`                                                                                        |
| `geometry`   | F → H     | none                                                                                                      |
| `error`      | F → H     | `requestId: number \| null`, `code: "unavailable" \| "invalid-boundary" \| "limit" \| "missing-instance"` |
| `dispose`    | H → F     | none                                                                                                      |

`list` returns boundaries; highlight/scroll-to/subscribe return ack or error.
Subscribe replaces the event set; empty unsubscribes. Event messages require
an active subscription. Request ids are strictly increasing positive safe
integers within a mount; replies must match the outstanding request and expected
response type. Ignore wrong-origin/source/nonce and malformed messages without
reply. An authenticated invalid response fails its host operation; inspector
errors describe only valid requests it could not fulfill. No free-form errors
cross the frame boundary.

Keys must match `/^[a-f0-9]{64}$/`; range ids match `/^r-[0-9]+$/`, at most 16
characters. Maximum per mount/list: 1,024 instance keys, 4,096 ranges and 8,192
boxes, with at most 64 boxes per range or pointer event. Coordinates are finite
numbers in `[-1000000, 1000000]`; width/height in `[0, 1000000]`. Boundaries sort
by key and their ranges by recorded DOM order. Empty highlight keys select no
regions; off requires an empty list. Every requested/returned key and range must
belong to that mount's validated usage. Never silently truncate lists or boxes;
limit overflow reports unavailable inspection via `limit`, leaving content usable.

Navigation ids are kebab-case, at most 256 ASCII characters; optional fragments
use the [logical fragment grammar](./mokly-navigation.md), at most 256 characters.
Named targets use its target grammar and the same limit; all other target
objects contain only `kind`. Navigation contains no URL, href, label or HTML.
The inspector classifies only authenticated immediate native-link activations;
the host revalidates ids against its catalogue and resolves canonical routes.
Primary versus modified/middle activation preserves the existing target rules.
The host owns navigation/new-context actions, using `noopener`; the inspector
never navigates a top window. Ordinary unmarked/download/external links stay
frame-owned. Asynchronous popup restrictions fail safely without granting the
frame popup permission. Cross-origin inspection is not permission to inspect
nested documents or trust arbitrary messages from consumer scripts.

Hover/geometry updates coalesce to one of each per animation frame, at most
60 of each per second; pointer exit reports `key: null, boxes: []`. Re-measure
after geometry events. Inspection data contains keys and boxes only, plus range
ids and the bounded control/navigation metadata above: never consumer text,
HTML, prop values, source paths, selectors, or arbitrary attributes. Labels come
from the catalogue in the host, not DOM text. Host validation rejects unknown
keys even after a valid handshake; the nonce binds a mount, not content honesty.
The viewer uses the same `geometry` notification and `list` response to refresh
package labels and host marker placement. This adds no wire field, message type
or inspector-bundle behavior.

## Published Inspector And Overlay

The Browse document adapter injects the dependency-free inspector IIFE from
`__mokly/client/inspector.js` into **current published HTML copies only**, after
ownership and marker validation. It supplies an inert allowlisted map of
instance keys to range ids/parents and validated logical-link identities from
that document's accepted metadata, so `r-n` comments can be resolved without
reading a manifest. Bound this map to the limits above and 262,144 UTF-8 bytes;
oversized maps disable cross-origin inspection explicitly. No private evidence
or source text is embedded. Unowned files get no inspector/map.
Repository preview validates portable consumer resources before adaptation;
the complete export inventory validates the injected package resource afterward.

The inert `template[data-mokly-inspector]` contains JSON with `ranges` and
`links`, plus optional `error: "limit" | "unavailable"`. Range index `n` denotes
`r-n`; each tuple is `[instanceKey | null, parentIndex | null]`. Null keys denote
slots; parents refer only to earlier indices and must match actual nesting.
Distinct keys derive from these authenticated ranges, including empty pairs.
Links use `FrameNavigation` without `activation`, with at most 1,024 distinct
identities. Overflow publishes an explicit error map, never a truncated map.
Each accepted native link receives `data-mokly-inspector-link="n"`, indexing the
deduplicated `links` array. Consumer-authored inspector markers and link indices
are rejected. Both publication nodes are inserted into the head so body child
positions and authored selectors remain unchanged, including implicit heads.

On request the script draws the existing dimming mask and outlines in-frame;
host labels and keyboard-accessible instance lists use public catalogue titles
and returned boxes. Pick reuses Highlight components visuals. Do not clone or
restyle consumer content. No overlay exists without a highlight/pick request.
Overlay nodes are excluded from range/occlusion measurements and observers
must not create a redraw loop. Disposal removes all package-owned overlay nodes.
The in-frame SVG lives in a shadow root on a host after the body: consumer styles
cannot restyle its shapes, redraw mutations stay outside observation, and body
range/occlusion measurements exclude the host. Outgoing fields contain only
validated ASCII identities/control values and numeric geometry; serialized
character length therefore equals its UTF-8 byte length. Incoming strings still
require explicit UTF-8 measurement before parsing.
The host resets all presentation properties with inline important declarations,
then sets its fixed, transparent, pointer-inert layout. The shadow SVG resets
inherited presentation and explicitly remains pointer-inert before applying the
owned mask and outline attributes.
Universal and element selectors, backgrounds, box-model rules, display, color
and opacity from consumer CSS cannot repaint the cutouts or hide the overlay.

Generated files and comparison snapshots stay byte-unmodified. Snapshots never
embed the script or negotiate a session. Local script-disabled
frames retain parent-owned highlighting even when published copies contain the
inert script. No React, server module, cookie, network request, or host-specific
integration is included in the IIFE. `scripts/package-check.mjs` must enforce
a **9 KiB (9,216 bytes) minified, uncompressed** script budget; the separately
bounded per-document inert metadata is not executable code and is excluded.

## Acceptance

Retain same-origin browser tests unchanged. Cross-origin fixtures must cover
handshake and inertness, wrong origins/sources/nonces, opaque origins, limits,
unknown fields, navigation, null/multi-root ranges, clipping, overlays, scroll,
view swaps, timeout and disposal. Check the script budget and prove comparison
bytes and local screenshots/interactions are unchanged.
