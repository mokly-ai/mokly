# Same-Origin Frame Loading

The [frame adapter contract](./mokly-frame-adapter.md) defines the shared API
and the separate cross-origin handshake. This document owns local loading,
authentication, and navigation while resource requests are pending.

## Ownership And Authentication

`sameOriginAdapter` confines `contentDocument` access to
[`same_origin_access.ts`](../../packages/viewer/src/client/same_origin_access.ts)
and the adapter-owned mount. Geometry, pointer inspection and presentation stay
in their dedicated local modules. A loaded document must retain the exact
origin, query and decoded resource path. A provider may canonicalize a final
`.html` suffix to the otherwise identical extensionless path; no other path
redirect is accepted. The URL fragment is client-only positioning rather than
resource identity, so the adapter authenticates the document first and then
applies a missing or changed validated fragment. An authenticated document
reload renews every document-scoped listener and observer without replacing the
outer frame session. Preserve ownership and range authentication, clipping,
highlighting, scroll restoration and logical-link classification unchanged.
Ready usage is required for instance inspection; absent usage does not disable
valid navigation.

When a same-origin replacement starts, the adapter transfers its mount-time
navigation receiver before changing `location` only when the currently visible
immediate document is the exact `Document` object that a previous same-origin
mount authenticated for that frame. Object identity is the transfer key because
scripts are disabled, so a document cannot change its resource identity, while
every frame navigation commits a new document. Valid marked activations in that
authenticated still-visible document therefore remain host-owned while the
assigned resource loads. A document that no mount authenticated, including one
the frame reached through its own native navigation, keeps portable native-link
behavior until the replacement authenticates.

The adapter records weak per-frame mount provenance and the last assigned
resource, separately from the iframe's initial `src` attribute. On the first same-origin
mount only, its immediate watcher may authenticate an already rendered
document whose resource exactly matches the assignment; this is the explicit
server-rendered hydration path. Every later mount captures the immediate
pre-replacement `Document`. When that exact object was not previously
authenticated for the frame, both the watcher and `load` handler exclude it
from assigned-resource authentication even if its URL exactly equals the new
assignment. Only a different replacement `Document` may then pass the resource
check. A rejected starting document must trigger a fresh history-replacing
navigation even when both its URL and the iframe's `src` equal the assignment;
URL equality alone cannot justify reuse or waiting for a load that is not in
progress. This decision is independent of document readiness: rejected starting
documents and different assigned resources are replaced while loading or
interactive as well as after completion. Changing the assigned resource also
cancels any earlier navigation, even when the still-visible authenticated
document already matches the new choice. A delayed superseded response must
never overwrite the latest preview selection.

Authenticated matching documents and the initial matching server-rendered
document are reused without reloading; incomplete accepted documents wait only
for their own load completion. Only the first mount may wait for a
startup-assigned recorded fragment that has not committed yet. Frame and
document provenance is weakly held and does not extend either object's lifetime.

As soon as the new immediate `Document` becomes same-origin-accessible, the
adapter independently authenticates its exact origin, decoded resource path and
query, then moves the receiver before slower subresources can delay the iframe
`load` event. The replacement watcher and `load` handler accept only this
assigned-resource authentication; previously authenticated identity never lets
a transferred document satisfy a new mount. Readiness installs inspection and
geometry over the authenticated document. Unsubscribing or disposing removes
the receiver, so an unenhanced document continues to use its portable native
links.

The sandbox remains exactly `allow-same-origin`; consumer scripts stay disabled.
Historical [removed previews](./mokly-removed-previews.md) and
[comparison panes](./mokly-comparison-panes.md) bypass this adapter as guarded,
viewer-origin `srcdoc`; panes add only their documented scrolling behavior.
Existing local memory previews retain their authenticated private transport.
No inspector handshake, extra badge, pick control, or visible affordance appears
locally. Panes gain no inspection, geometry, markers, or navigation messages.

## Load Deadline And Cleanup

A same-origin mount, including a temporary component preview, has a 30-second
load deadline from the start of the mount. This budget includes the initial
HTML request and its blocking stylesheets and other subresources. It is not a
handshake deadline: consumer scripts remain disabled and no inspector handshake
runs. A cold document that needs more than five seconds must still complete
within this load budget and preserve host-owned logical navigation.

The authenticated document receives navigation handlers before its `load`
event, as defined above. Inspection becomes ready only after that document
finishes loading. Completion clears the timer. Cancellation, replacement, or
expiry removes navigation handlers, polling, listeners and observers; expiry
rejects with `timeout`, and explicit cancellation rejects with `disposed`.
Releasing a delayed response after cancellation or expiry must not resolve the
old mount or reinstall its handlers. A fresh mount has its own load budget.

The cross-origin handshake and request deadlines remain five seconds under the
[shared frame contract](./mokly-frame-adapter.md#cross-origin-mount-and-handshake).

## Acceptance

Hold a real stylesheet request beyond five seconds for both current and
temporary local previews. Verify that the mount remains pending and marked
links still emit host navigation. Release the stylesheet and require successful
mount completion with working navigation. Repeat with explicit cancellation
and with the full 30-second deadline: the promise rejects, late load events
stay inert, and links recover native behavior after disposal. Keep the existing
same-origin authentication, replacement, inspection and cross-origin tests.

Browser helpers that wait for a frame's actual document URL or loaded state use
this same 30-second load budget. Hold HTML as well as stylesheets beyond five
seconds to cover both stages. UI-state assertions and whole-test deadlines stay
unchanged; a late load must still fail the document's finite deadline.
