# Same-Origin Frame Documents

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).
It defines how `sameOriginAdapter` authenticates, reuses and replaces the
documents of a frame on the viewer's origin, and which viewer-owned documents
bypass it.

## Document Authentication

A loaded document must retain the exact origin, query and decoded resource
path. A provider may canonicalize a final `.html` suffix to the otherwise
identical extensionless path; no other path redirect is accepted. The URL
fragment is client-only positioning rather than resource identity, so the
adapter authenticates the document first and then applies a missing or changed
validated fragment. An authenticated document reload renews every
document-scoped listener and observer without replacing the outer frame
session. Range authentication, including a component page's markerless root
region, follows the [range markers](./mokly-frame-probe.md#range-markers);
ownership, clipping, pick handling, scroll restoration and logical-link
classification match the frame probe. Ready usage is required for instance
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

## Sandbox And Viewer-Owned Documents

The sandbox remains exactly `allow-same-origin`; consumer scripts stay disabled.
Historical [removed previews](./mokly-removed-previews.md) and
[comparison panes](./mokly-comparison-panes.md) bypass this adapter as guarded,
viewer-origin `srcdoc`; panes add only their documented scrolling behavior.
Local memory previews use their authenticated private transport.
No frame probe handshake, extra badge, pick control, or visible affordance
appears locally. Panes gain no inspection, geometry, markers, or navigation messages.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Frame probe](./mokly-frame-probe.md)
- [Frame link navigation](./mokly-frame-link-navigation.md)
- [Catalogue navigation](./mokly-navigation.md)
