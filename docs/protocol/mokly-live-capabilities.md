# Live Viewer Capabilities

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Boundary

The Browse shell renders in the browser from the catalogue index and one
entry detail per entry, in Serve and in the static output alike. Serve adds
two things the static output never has: the live descriptor v3 at
`/mokly-viewer/live.json` and the event stream at `/mokly-viewer/events`.
The [shell delivery contract](./mokly-shell-delivery.md#live-descriptor) owns
the descriptor's fields and when the shell fetches it. No page embeds a
descriptor, a token, or a route; no host marker, host loader, or live-only
client module exists; the client bundle under `mokly-viewer/client/**` is the
same in Serve and in the static output. A capability is behaviour the shell
builds in the browser from Serve JSON; it is never catalogue data.

Only the standalone shell that Serve delivers builds live capabilities. A
React host that embeds `MoklyViewer` and the static output have none: their
controls are read-only under the
[component controls contract](./mokly-component-controls.md), and they open
no event stream. The render-capability token never enters the index, a
detail, a URL, local storage, or the shell store.

## Render Capability

The descriptor carries the temporary-render capability of the component
controls contract, bound to the bundle `generation` it names. The shell holds
the capability in one closure that performs the render request and exposes
`temporaryPreviews.render` and `temporaryPreviews.expired` through one React
context; `useViewerCapabilities()` returns them in Serve and `undefined`
elsewhere. React invokes rendering through the closure, so the token cannot
enter store state. A render response is accepted only when its generation
equals the installed one and its view matches the request; expiry checks
cover only preview URLs the shell received.

Every capability call carries the current route and the installed
`deploymentId`, `revision`, and generation. A result whose values differ from
the installed ones is discarded. Navigation, a sibling-variant change, a
revision adoption, and unmount abort work in flight and release nothing to
the store. When the index's `live.generation` changes, the shell refetches
the descriptor and replaces the capability; a render request against the old
generation fails with the stale-generation code of the controls contract, and
the shell rerenders the current validated props against the new one.

When the descriptor fetch fails while the index names a generation, browsing
works and live prop editing is unavailable with a browser warning; the shell
retries on the next update. A descriptor with another `schemaVersion` is the
version error of the [viewer namespace](./mokly-viewer-namespace.md).

## Updates

The event stream is the only push channel. One effect-scoped subscription
owns one `EventSource` on `/mokly-viewer/events`, opened when the index
carries `live`; abort, page exit, or effect replay closes it and any refresh
in flight. A message carries the new `revision` as its id, and the shell
refreshes the index and the current entry's detail under the
[shell delivery updates](./mokly-shell-delivery.md#updates-in-serve). How the
refreshed state reaches the navigation, the frames, and the workspace is the
[live evidence contract](./mokly-live-evidence.md). No message carries data,
no update reloads the page, and no reload recovery exists.

`EventSource` is an optional browser facility. When it is missing, denied, or
throws, the shell still renders the catalogue, reports the transport failure
as a browser warning, and leaves only live updates unavailable; a page load
fetches the current state. A malformed descriptor or an index with another
`deploymentId` follows the shell delivery fail-closed rules.

## Delivery Checks

Serve and `build` deliver one client inventory under `mokly-viewer/client/`,
`shell.css`, and `fonts/**`, with React inside the shell bundle only; every
import resolves within that inventory. The static output contains no
descriptor, no token, no event stream, and no control route, and its shell
issues no request to one. Browser coverage proves that a static page and an
embedded viewer make no live request, that a Serve page with the stream
denied still browses, and that a stale-generation render response never
replaces a preview.
