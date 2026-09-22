# Browse client and frame adapters

These browser modules provide the frame adapters, message transport, geometry
and revision-adoption boundaries consumed by the hydrated React shell. Shell
navigation, selection, comparisons and component inspection live under
`src/shell`; this directory contains no second interaction runtime. The package
build bundles the browser-safe modules into `dist/browser` and generates an
adjacent manifest from the completed esbuild outputs. Serve validates exact
manifest/directory equality before binding and uses that inventory for delivery
and export. The package graph check verifies every delivered static and dynamic
import resolves within that complete inventory.

`host_capability_descriptor.ts` validates the private live Serve bootstrap and
source identity. `host_capabilities.ts` defines the behavior context, atomic
public/private evidence revision and route/source cancellation scope. Both are
kept protocol modules; static export omits their standalone browser outputs.

Disclosure capture and pre-hydration navigation width capture are owned directly
under `src/standalone`. The synchronous navigation bootstrap records native
disclosure choices outside the React-owned DOM, and React reads that state for
its initial hydration render. Interactive navigation resizing starts after
hydration. Load or page exit cleans up capture state, and unfiltered choices use
the existing durable preference. The standalone build continues to deliver
this entry as `navigation-resize.js`.

Standalone appearance is also owned under `src/standalone`, not by a second
client interaction runtime. The classic `appearance-startup.js` bundle restores
the document mark, preference and system listener before styles paint, updates
parsed frames and the native selector, and exposes a narrow refresh handoff.
The browser entry refreshes that controller before hydration; the React bridge
then adopts its effective document scheme while the shell store independently
selects an available preview scheme. The selector stays hidden if the classic
host is absent. Persisted page exits keep the controller for back-forward-cache
restoration and refresh it on return; final exits dispose it and its lifecycle
listeners. The complete build-output manifest delivers both the classic bundle
and `react-shell.js`.

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
`inspector/clipping.ts`; `same_origin_highlight.ts` owns the unchanged
mask, labels, selection and observer lifecycle.

`same_origin_identity.ts` is the single document-authentication boundary for
same-origin mounts. It records authenticated `Document` objects without
retaining them, transfers mount-time navigation ownership only when the exact
current object was previously authenticated for that frame, and separately
checks every watcher or `load` candidate against the assigned resource through
a mount-scoped capability. Weak frame provenance permits matching SSR content
on the first same-origin mount. A later mount excludes its exact unrecorded
starting object even when its URL equals the assignment, so an unowned document
reached through native frame navigation keeps portable link behavior until a
different replacement object authenticates.
Once hydrated, adapters exclusively navigate live previews with history
replacement. The server's initial `src` may therefore remain unchanged after a
scheme swap. A transferred authenticated document at a different URL must be
replaced even when that initial attribute names the requested URL; only the
first mount may wait for a startup-assigned fragment already loading.

Frames holding a previous version carry `data-mokly-preview-frame` and
`data-mokly-preview-source`. They are owned directly by the
[React preview controller](../previews/README.md), not a frame adapter, so no
inspector or logical-navigation handshake happens for historical documents.
The controller fetches each historical document and presents it as a
viewer-origin, script-disabled `srcdoc`; its parent guard therefore cancels
every link and form in every host, owns same-document anchor scrolling, and
restores the accepted presentation if the frame navigates.

`post_message_adapter.ts` explicitly opts into a separate HTTP(S) origin. It sets
the cross-origin sandbox, replaces iframe history, and negotiates a fresh random
nonce after load. `message_transport.ts` owns the five-second request timeouts,
16-request bound and response matching. A replacement or disposal invalidates
the session and all pending work. Subscriptions share one remote event set;
removing the final subscriber sends an empty replacement set.
`frame_usage.ts` shares the automatic event capability rule: only validated ready
usage enables pointer inspection and geometry events; other usage retains only
navigation. Both built-in mounts accept `updateUsage` to refresh this capability
without replacing their document/session. The update clears old inspection
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

Standalone saved variants use shell history. Embedded viewers propose public
selection through the host boundary, and apply a variant only after controlled
or uncontrolled selection commits. This avoids a second private variant state
or direct history write inside embedded viewers.

```bash
npm run build
node --import tsx --test tests/inspector_schema.test.ts tests/post_message_adapter.test.ts
npx playwright test tests/browser/frame_adapter.spec.ts tests/browser/frame_adapter_security.spec.ts tests/browser/same_origin_adapter.spec.ts
```

Related boundaries: [inspector](../inspector/README.md),
[Browse document adaptation](../../../../src/browse/README.md),
[logical navigation](../../../../docs/protocol/mokly-navigation.md), and
[implementation plans](../../../../plans/README.md).
