# Inspector Handshake And Wire Protocol

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).
It defines how `postMessageAdapter` mounts a frame on a separate origin and
exchanges messages with the in-frame inspector.

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
`event.origin === expectedHostOrigin`; it pins the first accepted nonce for that
document and replies `ready` to that exact origin. Duplicate hello with the same
nonce may resend ready; another nonce cannot replace the session. The adapter
accepts replies only when `event.source === frame.contentWindow`,
`event.origin === frameOrigin`, and channel, version and nonce match its active
mount. Both sides use exact `targetOrigin` for every `postMessage`, never `"*"`.
No `window.top` or `parent.location` reads/writes occur. The inspector is inert
without handshake: no overlays, navigation interception, geometry collection or
outgoing messages. Only its bounded handshake listener exists before activation.

Ready/requests time out after five seconds, disposing the session without retries.
Disposal/unload clears all work; a fresh mount loads a new document and nonce.
At most 16 requests are pending.

## Wire Protocol v2

Every message is a JSON string of at most 262,144 UTF-8 bytes; reject nonstrings
or oversized strings before JSON parsing. The exact envelope is
`{ channel: "mokly-inspector", version: 2, nonce, type, ...fields }`.
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
characters; wire fragments match `/^[A-Za-z][A-Za-z0-9_:.-]*$/`, at most 256
characters. Named targets use the [target grammar](./mokly-navigation.md#link-targets) and the same limit;
all other target objects contain only `kind`. Navigation contains no URL, href,
label or HTML. The inspector classifies only authenticated immediate native-link
activations; the host revalidates paths against its catalogue and resolves URLs.
Primary versus modified/middle activation follows the
[enhanced navigation rules](./mokly-navigation.md#enhanced-navigation-and-safe-degradation).
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
package labels and host marker placement.

## Published Inspector

Static injection, inert document metadata, overlay isolation, and the script
budget are defined by the [published inspector contract](./mokly-published-inspector.md).
They do not change the handshake, the wire messages, or the same-origin adapter.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Published inspector and overlay](./mokly-published-inspector.md)
- [Frame link navigation](./mokly-frame-link-navigation.md)
