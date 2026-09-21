# Standalone viewer host

These modules compose `@mokly/viewer/runtime` for local Serve and exported
catalogues. Serve and export render the viewer's shell tree on the server and
hydrate it with the package's bundled React; these CLI modules supply Serve's
private capabilities to that tree. Reusable navigation, inspection and frame
adapters live in [the viewer package](../../packages/viewer/README.md). The
[React Browse shell plan](../../plans/react-browse-shell.md) defines the typed
[live capability boundary](../../docs/protocol/mokly-live-capabilities.md).

`react_host.ts` validates the private descriptor before hydrating.
`react_capabilities.ts` composes route evidence, update and on-demand rendering
capabilities. `react_capability_updates.ts` and `react_update_controller.ts` own
the event stream, latest-wins evidence refresh, reload recovery and cancellation.
Public catalogue and private workspace evidence are adopted as one revision;
authored content changes retain the reload lifecycle.

The synchronous viewer bootstrap captures native disclosure choices made before
module initialization. Browse preferences and one-shot recovery retain these
newer choices, then load completion persists them and removes the capture state.

`react_transports.ts` keeps local temporary previews and on-demand usage loads
private. `react_host.ts` hydrates even when the optional event stream or recovery
storage is unavailable. Export supplies no capabilities. No private tokens
enter catalogue JSON.

Run `npm test`, `npm run test:browser`, and `cargo xtask check` from the repository
root. See the [viewer contract](../../docs/protocol/mokly-viewer.md) and
[Serve lifecycle](../server/README.md).
