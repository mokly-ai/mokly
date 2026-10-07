# Standalone viewer host

## Delivery Status

The [React Browse shell plan](../../plans/react-browse-shell.md) records delivery
of the typed live capability boundary.

## Scope

These modules compose `@mokly/viewer/runtime` for local Serve and exported
catalogues. Serve and export render the viewer's shell tree on the server and
hydrate it with the package's bundled React; these CLI modules supply Serve's
private capabilities to that tree. Reusable navigation, inspection and frame
adapters live in [the viewer package](../../packages/viewer/README.md).
The [live capability contract](../../docs/protocol/mokly-live-capabilities.md)
defines the typed boundary.

`react_host.ts` validates the private descriptor before hydrating.
`react_capabilities.ts` composes route evidence, update and on-demand rendering
capabilities with `entryPath` request identity. `react_capability_updates.ts` and `react_update_controller.ts` own
the event stream, latest-wins evidence refresh, reload recovery and cancellation.
Each route or live-evidence page contributes a validated public bootstrap and a
complete private workspace for screen and component routes. The centralized
reader accepts only exact route scope and rejects complete, missing or leaked
live usage. They are adopted as one revision by replacing the prior catalogue,
never merging usage across visited routes. Until scoped adoption, the shell
reports Usage as loading; a current read failure or rejection reports failed
and supports retry without remounting the preview. Authored content changes
retain the reload lifecycle.

The synchronous viewer bootstrap captures native disclosure choices made before
module initialization. Browse preferences and one-shot recovery retain these
newer choices, then load completion persists them and removes the capture state.
Stored Browse recovery requires a live `changesStatus` and explicit
`filterBaselineDisclosures`. Missing values invalidate the stored snapshot.
General shell snapshots without a live status do not produce a stored Browse
record; the host does not invent a status for them.

`react_transports.ts` keeps local temporary previews and on-demand usage loads
private. `react_host.ts` hydrates even when the optional event stream or recovery
storage is unavailable. Export supplies no capabilities. All live transports use the shared
`VIEWER_DIRECTORY` prefix. Version rejection retains server-rendered content
and presents the compatibility message before hydration. No private tokens
enter catalogue JSON.
Temporary preview responses must name the requested generated document below
their authenticated render bundle. The transport uses the shared generated
resource address and still rejects another view, render identity or generation.

The browser passes the exact embedded bootstrap and capability-descriptor text
through hydration, so subsequent shell renders do not serialize either state.

Run `npm test`, `npm run test:browser`, and `cargo xtask check` from the repository
root. See the [viewer contract](../../docs/protocol/mokly-viewer.md), the
[bootstrap contract](../../docs/protocol/mokly-shell-bootstrap.md), and the
[Serve lifecycle](../server/README.md).
