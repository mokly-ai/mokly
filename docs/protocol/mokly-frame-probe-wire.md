# Frame Probe Handshake And Wire Protocol

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).
It defines how `postMessageAdapter` mounts a frame on a separate origin and
exchanges messages with the [frame probe](./mokly-frame-probe.md).

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
view's validated hash and other approved parameters. The frame probe requires
exactly one valid HTTP(S) host-origin parameter distinct from its own origin.
The static host must ignore queries for file lookup. Never derive trust from
`document.referrer`, a message-supplied origin, or a wildcard.

After load, the adapter sends `hello` to the exact `frameOrigin`. The frame
probe accepts it only from `event.source === window.parent` and
`event.origin === expectedHostOrigin`; it pins the first accepted nonce for that
document and replies `ready` to that exact origin. Duplicate hello with the same
nonce may resend ready; another nonce cannot replace the session. The adapter
accepts replies only when `event.source === frame.contentWindow`,
`event.origin === frameOrigin`, and channel, version and nonce match its active
mount. Both sides use exact `targetOrigin` for every `postMessage`, never `"*"`.
No `window.top` or `parent.location` reads/writes occur. The frame probe is
inert without handshake: no navigation interception, geometry collection or
outgoing messages. Only its bounded handshake listener exists before
activation.

The load of the document has no time limit. Ready must arrive within five
seconds after hello, and each reply within five seconds after its request.
A timeout outside a restore check disposes the session without retries.
Disposal clears all work. A fresh mount loads a new document and nonce.
At most 16 requests are pending.

A `pagehide` with `persisted: true` keeps the session in the back-forward cache.
Other `pagehide` events dispose it. On a persisted `pageshow` in the host, the
adapter sends `hello` again for each ready mount with its original nonce. If
`ready` does not arrive within five seconds, the adapter disposes the mount
without an error event. During this check, a request timeout fails the request
without an error event and the `ready` check continues.

A frame that asks for access first runs the access phase of the
[frame access contract](./mokly-frame-access.md#access-phase). The adapter then
sends `hello` to the document that loads after the start page, and these rules
apply to that document.

## Wire Protocol v3

Every message is a JSON string of at most 262,144 UTF-8 bytes; reject nonstrings
or oversized strings before JSON parsing. The exact envelope is
`{ channel: "mokly-frame-probe", version: 3, nonce, type, ...fields }`.
All objects must be plain JSON objects with exactly the fields for their
discriminant; reject unknown keys recursively, unsupported versions/types,
duplicates in key/range arrays, invalid numbers and broken references. Do not
coerce strings to numbers or accept DOM nodes, transferable ports or binary data.

All types/fields follow; `H` is the host adapter, `F` the immediate frame probe.

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
reply. An authenticated invalid response fails its host operation; frame probe
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
characters; wire fragments match `/^[A-Za-z][A-Za-z0-9_:.-]*$/`, at most 256
characters. Named targets use the [target grammar](./mokly-navigation.md#link-targets) and the same limit;
all other target objects contain only `kind`. Navigation contains no URL, href,
label or HTML. The frame probe classifies only authenticated immediate
native-link activations; the host revalidates paths against its catalogue and
resolves URLs. Primary versus modified/middle activation follows the
[enhanced navigation rules](./mokly-navigation.md#enhanced-navigation-and-safe-degradation).
The host owns navigation/new-context actions, using `noopener`; the frame probe
never navigates a top window. Ordinary unmarked/download/external links stay
frame-owned. Asynchronous popup restrictions fail safely without granting the
frame popup permission. Cross-origin inspection is not permission to inspect
nested documents or trust arbitrary messages from consumer scripts.

`hover` and `click` name instances under the hover rule of the
[selection contract](./mokly-viewer-selection.md#selection-events-and-imperative-use),
for the keys and the mode of the latest `highlight`.
Hover/geometry updates coalesce to one of each per animation frame, at most
60 of each per second; pointer exit reports `key: null, boxes: []`. Re-measure
after geometry events. Inspection data contains keys and boxes only, plus range
ids and the bounded control/navigation metadata above: never consumer text,
HTML, prop values, source paths, selectors, or arbitrary attributes. Labels come
from the catalogue in the host, not DOM text. Host validation rejects unknown
keys even after a valid handshake; the nonce binds a mount, not content honesty.
The viewer uses the same `geometry` notification and `list` response to redraw
the highlight mask and the package labels and to refresh host marker placement.

## Wire Protocol v4

Version 4 keeps every rule of [version 3](#wire-protocol-v3), and its
`subscribe` request accepts five more event names. It adds requests for the
box model of an instance and the content box of a document. Its envelope
carries `version: 4`. Each peer accepts only its own version. A version 3 probe
and a version 4 viewer reject each other's handshake.

| Type              | Direction | Additional fields                                                             |
| ----------------- | --------- | ----------------------------------------------------------------------------- |
| `measure`         | H → F     | `requestId`, `key`                                                            |
| `box-model`       | F → H     | `requestId`, `boxModel: InstanceBoxModel \| null`                             |
| `measure-content` | H → F     | `requestId`                                                                   |
| `content-box`     | F → H     | `requestId`, `contentBox: Box \| null`                                        |
| `canvas-wheel`    | F → H     | `deltaY: number`, `deltaMode: 0 \| 1 \| 2`, `x: number`, `y: number`          |
| `canvas-pinch`    | F → H     | `scale: number`, `x: number`, `y: number`                                     |
| `canvas-key`      | F → H     | `key: "zoom-in" \| "zoom-out" \| "zoom-100" \| "fit" \| "escape" \| "search"` |
| `canvas-focus`    | F → H     | `visible: boolean`                                                            |
| `canvas-blur`     | F → H     | none                                                                          |

`measure` returns `box-model` or `error`. `InstanceBoxModel` has exactly the
fields `box`, `border` and `padding`. `border` and `padding` each have exactly
the fields `top`, `right`, `bottom` and `left`. `box` follows the box bounds of
version 3, and each side is a finite number from 0 to 1,000,000. A null
`boxModel` means that the instance has no box model. The
[box model rules](./mokly-frame-box-model.md) define every value. A key
outside the mount's validated usage gets `error` with `missing-instance`, and a
measurement outside the bounds gets `error` with `limit`. The reply carries
numbers only. The host measures again after a `geometry` event, as it lists
boundaries again.

`measure-content` returns `content-box` or `error`. `contentBox` holds null or
one box within the version 3 bounds. The
[content box rules](./mokly-frame-content-box.md) define the measurement. The
probe answers even if its published map is missing or reports an error. An
out-of-bounds measurement returns `error` with `limit`.

`subscribe.events` also accepts `canvas-wheel`, `canvas-pinch`, `canvas-key`,
`canvas-focus` and `canvas-blur`. The list holds at most ten unique names.
Until the subscription names `canvas-wheel` or `canvas-pinch`, the probe holds
no wheel or gesture listener. The probe uses the
[canvas input rules](./mokly-frame-canvas-input.md) to report input and focus.

`deltaY`, `x` and `y` are finite numbers in `[-1000000, 1000000]`. `scale` is
a finite number greater than 0 and at most 1,000,000. `deltaMode`, `key` and
`visible` accept only the values in the table. The host ignores a canvas event
with an invalid value or an extra field, as it ignores other malformed event
messages.

The probe sends at most one wheel, one pinch, and one focus or blur message per
animation frame. It sends at most 60 wheel messages, 60 pinch messages, and
60 focus or blur messages combined per second. It sends key events immediately.

## Frame Probe Script

Static injection, inert document metadata, the rule that the script draws
nothing, and the script budget are defined by the
[frame probe contract](./mokly-frame-probe.md).
They do not change the handshake, the wire messages, or the same-origin adapter.
The access relay of the frame probe uses the separate access channel of the
[frame access contract](./mokly-frame-access.md#access-channel), so this wire
and its version stay unchanged.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Frame probe](./mokly-frame-probe.md)
- [Frame access](./mokly-frame-access.md)
- [Frame package](./mokly-frame-package.md)
- [Frame link navigation](./mokly-frame-link-navigation.md)
