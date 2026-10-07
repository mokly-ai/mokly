# Frame Link Navigation

This continues the [navigation contract](./mokly-navigation.md).

The implemented `sameOriginAdapter` preserves this existing behavior;
direct `contentDocument` access lives behind the local transport interface.
The viewer package exposes the same boundary. Logical fragment scope is resolved
once in the frame URL boundary shared by public markup and adapter mounts:
standalone views receive the fragment; flows apply it only to step zero,
including across scheme and viewport changes. Logical target
parsing, marker validation, modifier/target classification, canonical
routes and safe degradation do not change. No adapter gains nested-frame access.
The optional `postMessageAdapter` requires a separate, nonopaque frame origin
and the [inspector handshake](./mokly-frame-adapter.md#cross-origin-mount-and-handshake).
It carries bounded logical paths/fragments and activation/target states, never
consumer hrefs, labels or arbitrary navigation URLs. The host revalidates the
destination against its catalogue and owns the navigation action; the inspector
never reads or changes `window.top` or `parent.location`. Cross-origin hosts
grant `allow-same-origin allow-scripts` only under that explicit contract;
default local Browse and all comparison snapshot restrictions remain unchanged.
