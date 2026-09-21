# Shared Browse shell

These React components render the existing catalogue, stages, navigation and
inspector. `document.tsx` supplies the standalone document envelope used through
`@mokly/viewer/server`; React hosts render the same components into stable runtime
islands with separate host-owned slots.

`css.ts` concatenates the standalone stylesheet. Split string modules preserve
its exact bytes. The package build scopes an embedded stylesheet separately and
uses packaged relative font URLs; standalone Serve/export retain their original
CSS and font delivery paths.

`catalogue.ts` owns pure display indexing. Historical repository access remains
in the CLI's `src/server/baseline_catalogue.ts`. `workspace_data.ts` describes
shell data; the public viewer projects it only from validated catalogue records.
The CLI supplies its private live capabilities through typed server context.

`previews.tsx` renders the one previous-version presentation a removed page and
a removed screen share: the "Showing previous version" label, the stage host
carrying the descriptor the browser client requests from, and the device chrome
a screen preview clones. It advertises a packaged address only when the accepted
public catalogue publishes one, so a delivery without that descriptor stays
quiet. The served stage holds the unavailable copy without a Retry control,
because a shell whose browser client never runs cannot honour that action; the
client's first update replaces it with the loading state and adds Retry only if
its own request fails. The copy and Retry hook come from `previews/copy.ts`.
`views.tsx` uses it for removed pages and `workspace.tsx` for removed screens;
both drop the comparison band there, while removed component variants keep
theirs.
`css_previews.ts` styles the stage, including the `mbk-preview-note` and
`mbk-preview-switch` classes the design catalogue's stage stylesheet owns. Its
Both-only rule reads the normalized `data-viewport` value on the live stage.
See [previews](../previews/README.md) for the client side.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).
