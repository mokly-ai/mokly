# Standalone viewer host

These modules compose `@mokly/viewer/runtime` for local Serve and exported
catalogues. `browse.ts` boots the shared vanilla enhancements; exported browsers
never load React. Reusable navigation, inspection and frame adapters live in
[the viewer package](../../packages/viewer/README.md).

`browser.ts` and `live_updates.ts` retain the private Serve event stream and reload
recovery. `browse_refresh.ts` validates public evidence revisions through the
viewer update seam, then reconciles private shell evidence in place. Navigation
and content generation checks fence both responses before adoption. Authored
content changes retain the existing reload lifecycle.

The revision validator loads on demand after an evidence response arrives.
It is absent from the initial module graph, so live-state restoration does not
wait for catalogue decoding code. Cancellation and navigation fences also cover
that deferred import. Package graph checks validate dynamic asset imports.

The synchronous viewer bootstrap captures native disclosure choices made before
module initialization. Browse preferences and one-shot recovery retain these
newer choices, then load completion persists them and removes the capture state.

`control_transport.ts` and `workspace_loading.ts` keep local temporary previews
and on-demand rendering private. They are injected with `installViewerServices`;
export supplies no capabilities. No private tokens enter catalogue JSON.

Run `npm test`, `npm run test:browser`, and `cargo xtask check` from the repository
root. See the [viewer contract](../../docs/protocol/mokly-viewer.md) and
[Serve lifecycle](../server/README.md).
