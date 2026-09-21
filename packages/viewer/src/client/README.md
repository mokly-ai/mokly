# Browse client and frame adapters

These browser modules enhance the existing server-rendered Browse shell. They
own navigation, viewport and theme state, comparisons, and component inspection.
The package build bundles their pure dependencies into `dist/browser`; the
server's explicit client-module allowlist also supplies the export inventory.

`browse_appearance.ts` takes the standalone Appearance control over from the
classic `appearance-startup.js` asset. The asset paints the appearance before
this module exists; once Browse is running, its `onAppearance` hook re-applies
the same scheme through `setColorScheme`, so frames swap with history replaced
and comparison panes and component samples redraw. Each swap compares the
current source first, so the asset's earlier swap is never repeated. The
workspace listens for the `mokly:appearance` document event rather than owning
its own standalone control or receiving a second direct comparison update. The
hook is tied to the Browse document's abort signal and clears the startup
asset's `window.onAppearance` slot on page exit. See the
[appearance contract](../../../../docs/protocol/mokly-viewer-appearance.md).

`early_disclosures.ts` bridges native disclosure clicks through deferred startup.
The synchronous navigation bootstrap starts capture; Browse initialization and
reload recovery reapply the latest native choices. Load or page exit cleans up
capture state, and unfiltered choices use the existing durable preference.

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

`installWorkspace` preserves standalone saved-variant history by default. The
React viewer supplies a variant proposal hook instead: the control proposes
public selection, and the returned `setVariant` operation applies only a
committed controlled or uncontrolled selection. This avoids a second private
variant state or direct history write inside embedded viewers.

```bash
npm run build
node --import tsx --test tests/inspector_schema.test.ts tests/post_message_adapter.test.ts
npx playwright test tests/browser/frame_adapter.spec.ts tests/browser/frame_adapter_security.spec.ts tests/browser/same_origin_adapter.spec.ts
```

Related boundaries: [inspector](../inspector/README.md),
[Browse document adaptation](../../../../src/browse/README.md),
[logical navigation](../../../../docs/protocol/mokly-navigation.md), and
[implementation plans](../../../../plans/README.md).
