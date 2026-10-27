# Frame Link Navigation

This continues the [navigation contract](./mokly-navigation.md).

`sameOriginAdapter` preserves this behavior. The viewer package exposes the
same boundary. Public markup and adapter mounts apply the same logical fragment
scope: standalone views receive the fragment; flows apply it only to step zero,
including across scheme and viewport changes. Every adapter keeps the logical
target parsing, marker validation, modifier/target classification, canonical
routes and safe degradation of the navigation contract. No adapter gains
nested-frame access. The optional `postMessageAdapter` requires a separate,
nonopaque frame origin and the
[inspector handshake](./mokly-inspector-wire.md#cross-origin-mount-and-handshake).
It carries bounded logical paths/fragments and activation/target states, never
consumer hrefs, labels or arbitrary navigation URLs. The host revalidates the
destination against its catalogue and owns the navigation action; the inspector
never reads or changes `window.top` or `parent.location`. Cross-origin hosts
grant `allow-same-origin allow-scripts` only under that explicit contract;
default local Browse and all comparison snapshot restrictions apply.
