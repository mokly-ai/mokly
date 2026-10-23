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

Standalone appearance is owned under `src/standalone`, not by a second
client interaction runtime. The browser entry installs the controller of
`startup.ts` before the shell's first render: it restores the document mark,
preference and system listener, updates frames and the native selector, and
exposes a narrow refresh handoff. The React bridge then adopts its effective
document scheme while the shell store independently selects an available
preview scheme. Persisted page exits keep the controller for back-forward-cache
restoration and refresh it on return; final exits dispose it and its lifecycle
listeners.

`frame_adapter.ts` defines the transport-independent mount, boundary, highlight,
scroll and event interfaces in the [frame contract](../../../../docs/protocol/mokly-frame-adapter.md).
They are exported by `@mokly/viewer`. A host supplies
a selected public view URL and its validated, scoped catalogue usage.

`same_origin_adapter.ts` retains script-disabled frames and parent-owned overlays.
Its private current-document capabilities support the synchronous local shell,
scroll restoration and authenticated temporary control previews. Direct frame
document/window access lives in the local transport, rather than workspace,
Browse state, or controls. `component_geometry.ts` retains its existing geometry
entrypoints and shares containing-block-aware clipping with the inspector in
[`../inspector/clipping.ts`](../inspector/clipping.ts);
`same_origin_highlight.ts` owns the unchanged
mask, labels, selection and observer lifecycle.

`same_origin_identity.ts` is the single document-authentication boundary for
same-origin mounts. Its shared pathname normalization accepts a page’s
`index.html` and its directory with or without a trailing slash; viewport
files also accept the host’s extensionless form. Origins and queries still
match exactly. It records authenticated `Document` objects without
retaining them, transfers mount-time navigation ownership only when the exact
current object was previously authenticated for that frame, and separately
checks every watcher or `load` candidate against the assigned resource through
a mount-scoped capability. Weak frame provenance permits a matching document
on the first same-origin mount. A later mount excludes its exact unrecorded
starting object even when its URL equals the assignment, so an unowned document
reached through native frame navigation keeps portable link behavior until a
different replacement object authenticates.
Once mounted, adapters exclusively navigate live previews with history
replacement. A frame's first `src` may therefore remain unchanged after a
scheme swap. `same_origin_load.ts` decides reuse, waiting, or replacement from
document ownership and the last assigned resource before considering readiness.
A new resource assignment cancels any superseded navigation, even if the
still-visible document already matches the latest choice. Rejected starting
documents are replaced while loading or interactive as well as after completion;
slow resources must not strand a scheme switch or reconnect. Only the first
mount may wait for a startup-assigned recorded fragment already loading.
An authenticated matching document can reconnect without reloading and waits
for completion before inspection becomes ready. Matching URLs alone do not
authorize reuse.

Frames holding a previous version carry `data-mokly-preview-frame` and
`data-mokly-preview-source`; comparison pane frames carry
`data-mokly-comparison-frame`, `data-mokly-preview-source` and
`scrolling="no"`. Both are owned directly by React controllers, the
[preview controller](../previews/README.md) and the comparison pane modules in
[the shell](../shell/README.md), not a frame adapter, so no inspector or
logical-navigation handshake happens for them. Each controller fetches every
snapshot document and presents it as a viewer-origin, script-disabled
`srcdoc`; its parent guard therefore cancels every link and form in every host,
owns same-document anchors, and restores the accepted presentation if the frame
navigates. Comparison pages are driven by their chrome viewports, while paired
inner regions, keys, and anchors follow the
[comparison scrolling contract](../../../../docs/protocol/mokly-comparison-scrolling.md).

`post_message_adapter.ts` explicitly opts into a separate HTTP(S) origin. It sets
the cross-origin sandbox, replaces iframe history, and negotiates a fresh random
nonce after load. `message_transport.ts` owns the five-second request timeouts,
16-request bound and response matching. A replacement or disposal invalidates
the session and all pending work. Subscriptions share one remote event set;
removing the final subscriber sends an empty replacement set.
`stage_sources.ts` normalizes the omitted usage of a view whose entry detail is
not held yet to the same pending frame state as a view awaiting evidence before
it reaches an adapter, so it shows the existing waiting copy rather than empty
or unavailable inspection.
`frame_usage.ts` shares the automatic event capability rule: only validated
ready usage enables pointer inspection and geometry events; other usage retains
only navigation. Both built-in mounts accept
`updateUsage` to refresh this capability without replacing their
document/session. The update clears old inspection
presentation and preserves navigation subscribers; no inspector wire change is
needed. Viewer frame updates use it when the document identity is unchanged.
The viewer inspection owner restores valid presentation after adoption, retains
explicit frame scope, and ends active picking with `evidence` when a referenced
target or ready usage disappears. Pending activation is cancelled without events;
subsequent inspection waits for refreshed usage. Superseded updates are fenced.
Geometry raised during initial presentation shares that work instead of issuing
a competing boundary read, so evidence cancellation retains one owner.
Public operations recheck disposal after awaiting a reply so a just-resolved
response cannot escape a replaced mount. Oversized usage maps keep content
mountable and report inspection as unavailable with the `limit` code.

The host must resolve navigation events through its validated catalogue and
existing route/new-context handling. Events contain logical identities and
activation metadata, never consumer URLs. The transport does not open windows.
Local Serve/export do not select this adapter or expose a pick control.

Standalone component variant entries use shell history. Embedded viewers
propose public selection through the host boundary, and apply a variant only
after controlled or uncontrolled selection commits. This avoids a second
private variant state or direct history write inside embedded viewers.

```bash
npm run build
cargo xtask check --suite viewer
```

Related boundaries: [inspector](../inspector/README.md),
[Browse document adaptation](../../../../docs/protocol/mokly-export-delivery.md),
[logical navigation](../../../../docs/protocol/mokly-navigation.md), and the
[shell delivery contract](../../../../docs/protocol/mokly-shell-delivery.md).

The approved frame identity boundary
uses one same-origin URL comparison for readiness and later inspection. It
accepts the provider's final `.html` removal and decodes each path only once;
no cross-origin response-path access is assumed.
