# Browse client and frame adapters

These browser modules provide the frame adapters, message transport, geometry
and usage-adoption boundaries consumed by the client-rendered React shell.
Shell navigation, selection, comparisons and component inspection live under
`src/shell`, and the shell's index, detail and live transports under
`src/shell/data_*` and `src/standalone`; this directory contains no second
interaction runtime. The package build bundles the standalone shell and the
frame inspector into `dist/browser/shell.js` and `dist/browser/inspector.js`
and generates the adjacent `dist/browser.manifest.json` from the completed
esbuild outputs. Serve and `build` deliver them as
`/mokly-viewer/client/shell.js` and the inspector script of the
[frame adapter contract](../../../../docs/protocol/mokly-frame-adapter.md).

## Same-origin frames

`sameOriginAdapter` keeps script-disabled frames and parent-owned overlays.
Its private current-document capabilities support the synchronous local shell,
scroll restoration, and authenticated temporary control previews. Workspace,
Browse state, and controls never read a frame document directly.

`normalizedHtmlPath` in `same_origin_identity.ts` treats a page's `index.html`
and its directory, with or without a trailing slash, as one resource. It also
accepts the extensionless form of a `.html` file. Origins and queries must
match exactly. Readiness checks and document authentication use this same
normalization. `same_origin_identity.ts` keeps authenticated documents and the
last assigned resource of each frame in weak collections, so this provenance
never extends the lifetime of a document or a frame. The Same-Origin Documents
section of the
[frame adapter contract](../../../../docs/protocol/mokly-frame-adapter.md)
defines which document a mount adopts, waits for, or replaces.

Frames that hold a previous version and comparison pane frames do not use a
frame adapter. The [preview controller](../previews/README.md) and the
comparison pane modules in [the shell](../shell/README.md) own them, under the
[removed previews](../../../../docs/protocol/mokly-removed-previews.md),
[comparison panes](../../../../docs/protocol/mokly-comparison-panes.md), and
[comparison scrolling](../../../../docs/protocol/mokly-comparison-scrolling.md)
contracts.

## Usage updates

[`../shell/stage_sources.ts`](../shell/stage_sources.ts) normalizes the omitted
usage of a view whose entry detail is not held yet to the same pending frame
state as a view awaiting evidence before it reaches an adapter, so it shows the
existing waiting copy rather than empty or unavailable inspection. The
[frame adapter contract](../../../../docs/protocol/mokly-frame-adapter.md)
defines `updateUsage`, the usage rules, and the inspection ownership.

## Cross-origin frames

Serve and the static build use the same-origin adapter. Only an embedding host
selects `postMessageAdapter`. The
[inspector handshake and wire protocol](../../../../docs/protocol/mokly-inspector-wire.md)
define the cross-origin session, and the
[frame link navigation contract](../../../../docs/protocol/mokly-frame-link-navigation.md)
defines the navigation events that the host resolves.

## Development

```bash
npm run build
cargo xtask check --suite viewer
```

### Key Code

- [`frame_adapter.ts`](./frame_adapter.ts) defines the public `FrameAdapter`,
  `FrameMount`, `MountedFrame`, and `FrameEvent` types that `@mokly/viewer`
  exports.
- [`same_origin_adapter.ts`](./same_origin_adapter.ts) holds
  `sameOriginAdapter`, the default adapter for script-disabled frames, and the
  private capabilities of the local shell and the temporary control previews.
- [`same_origin_mount.ts`](./same_origin_mount.ts) holds `mountLocalDocument`,
  which owns the load and the session of one same-origin mount.
- [`same_origin_identity.ts`](./same_origin_identity.ts) holds
  `createMountAuthentication`, the single document-authentication boundary for
  same-origin mounts.
- [`same_origin_load.ts`](./same_origin_load.ts) holds `initialFrameLoad`,
  which decides whether a mount adopts, waits for, or replaces the visible
  document.
- [`same_origin_access.ts`](./same_origin_access.ts) holds `localFrameAccess`,
  the only same-origin adapter code that reads a frame's document or window.
- [`same_origin_highlight.ts`](./same_origin_highlight.ts) holds
  `installLocalHighlight`, which draws the parent-owned mask, labels, and
  selection.
- [`component_geometry.ts`](./component_geometry.ts) holds `authenticateRanges`
  and `rangeBounds`, which measure clipped boxes with the clipping rules of
  [`../inspector/clipping.ts`](../inspector/clipping.ts).
- [`post_message_adapter.ts`](./post_message_adapter.ts) holds
  `postMessageAdapter`, the opt-in adapter for documents on a separate origin.
- [`message_transport.ts`](./message_transport.ts) holds `messageTransport`,
  the bounded request and reply state of one cross-origin session.
- [`frame_usage.ts`](./frame_usage.ts) holds `frameUsage` and `frameEvents`,
  which turn validated usage into inspector metadata and the allowed events.

Related boundaries: [inspector](../inspector/README.md),
[Browse document adaptation](../../../../docs/protocol/mokly-export-delivery.md),
[logical navigation](../../../../docs/protocol/mokly-navigation.md),
[selection and events](../../../../docs/protocol/mokly-viewer-selection.md#selection-events-and-imperative-use),
and the
[shell delivery contract](../../../../docs/protocol/mokly-shell-delivery.md).
