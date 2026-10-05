# Viewer Frame Adapter

## Delivery Status

Implemented in `@mokly/viewer`. Local Serve/export retain the same-origin
sandbox and visible behavior; explicit cross-origin hosts use inspector
transport. Host markers and trailing geometry refresh are implemented. Navigation
messages name entries by `screenPath`. Same-origin frame identity accepts an
`index.html` page at its containing directory with or without a trailing slash,
and other HTML files without their final `.html`, while retaining origin and
query identity.
Historical pages and screens use the viewer-owned presentation defined by the
[removed previews contract](./mokly-removed-previews.md). Neither adapter mounts
those frames or enters an inspection handshake; the viewer presents a
same-origin document and enforces the read-only guard in every host.

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

Each mount owns one immediate viewer-created frame and its current URL/usage.
The host supplies the selected catalogue view URL; the adapter confines it to
current `/static/` HTML paths, the configured origin and a valid logical hash.
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
A wrapper that changes the event stream, such as a test double, must wrap
`onEvent` itself and pass that wrapped callback when the shell subscribes its
mount-time receiver. Subscribing any other callback adds a second listener and
leaves the unwrapped receiver attached, so every event arrives twice and events
the wrapper meant to drop still arrive once.
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
URL/viewport/scheme/step identities; custom adapters that omit it retain
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

The [same-origin loading contract](./mokly-same-origin-loading.md) defines local
resource authentication, document ownership, early navigation, the 30-second
load deadline, and cleanup. Same-origin frames retain `allow-same-origin`
without script permission; cross-origin handshake rules below stay separate.

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

Navigation paths follow the [path grammar](./mokly-paths.md), at most 256 ASCII
characters; fragments use the [logical fragment grammar](./mokly-navigation.md),
at most 256 characters. Named targets use its target grammar and the same limit;
all other target objects contain only `kind`. Navigation contains no URL, href,
label or HTML. The inspector classifies only authenticated immediate native-link
activations; the host revalidates paths against its catalogue and resolves URLs.
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

## Published Inspector

Static injection, inert document metadata, overlay isolation, and the script
budget are defined by the
[published inspector contract](./mokly-published-inspector.md). They do not
change this adapter's handshake, wire messages, or same-origin behavior.

## Acceptance

Retain same-origin browser tests unchanged. Add an adversarial same-origin case
where a frame navigates itself to an unowned document carrying a syntactically
valid marker, then starts a replacement mount: the unowned document keeps native
activation and emits no host navigation, while the authenticated replacement
regains host-owned navigation. Repeat that case with the unowned document's URL
exactly equal to the next assigned resource, proving the starting object is
excluded while a different object loaded from that URL authenticates. Retain a
first-mount SSR hydration case proving its matching starting document remains
eligible. Cross-origin fixtures must cover handshake and inertness, wrong
origins/sources/nonces, opaque origins, limits, unknown fields, navigation,
null/multi-root ranges, clipping, overlays, scroll, view swaps, timeout and
disposal. Check the script budget and prove comparison bytes and local
screenshots/interactions are unchanged.
