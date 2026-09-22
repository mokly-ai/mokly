# Shared Browse shell

These React components are the Browse shell tree: catalogue, stages,
navigation and inspector. `document.tsx` supplies the standalone document
envelope used through `@mokly/viewer/server`, and the same tree is hydrated in
the browser by Serve, export and React hosts, with host-owned slots as ordinary
children. The [viewer contract](../../../../docs/protocol/mokly-viewer.md#shell-tree-and-state)
defines the tree and its state model; the
[React Browse shell plan](../../../../plans/react-browse-shell.md) records how
Serve, export and the public viewer converged on this tree.

`css.ts` concatenates the standalone stylesheet. Split string modules preserve
its exact bytes. The package build scopes an embedded stylesheet separately and
uses packaged relative font URLs; its selector-aware transform maps document
selectors and shell-root `.mbk` selectors to the embedding scope without
rewriting class names. Standalone Serve/export retain their original CSS and
font delivery paths.

`catalogue.ts` owns pure display indexing, including the shared route resolver
that gives current entries precedence over removed history. Historical
repository access remains in the CLI's `src/server/baseline_catalogue.ts`.
`store.tsx` and the focused `store_*` modules own standalone route/history,
selection, disclosure, drawer, details, recovery and scroll state. `routes.ts`,
`nav_model.ts`, `search_query.ts` and `entry_wording.ts` are deterministic
helpers shared by SSR and the live tree; `delivery.ts` validates static
deployment continuity before a read-model route transition. Frame documents
remain static while `frame_event_router.tsx` routes authenticated logical-link
events from visible sessions in the owning `frame_registry.tsx`.

`workspace_data.ts` describes shell data; the public viewer projects it only
from validated catalogue records. Embedded bootstrap and workspace JSON use
canonical key ordering so their validated client projections retain the exact
server bytes during hydration. `comparison_views.tsx` renders React-owned frame
chrome around the snapshots from validated comparison metadata. The CLI
supplies its private live capabilities through typed server context. Standalone
full-document composition lives in `src/standalone`: its bootstrap contains
the validated public catalogue and shell delivery state for Serve. Static pages
carry a compact identity/revision reference and resolve the shared finalized
catalogue before `src/browser.tsx` hydrates that exact server tree. Live Serve places private
route evidence in a separate descriptor; the capability store adopts the
fetched page's public bootstrap, source and private workspace as one monotonic
revision. `use_workspace_data.ts` keeps one route-owned workspace object so
matching evidence refreshes retain already loaded usage and local editor state.
Static export uses `src/standalone/static_workspace_evidence.ts` to read inert
workspace JSON from a destination shell in the mounted deployment, validating
the response route, compact catalogue reference, and delivery identities against
the already installed catalogue without enabling live host behavior or fetching
the catalogue again.

`workspace.tsx` coordinates the React workspace without owning transport or
frame internals. `component_controls.tsx` owns cancellable temporary prop edits;
the focused `workspace_*` components render evidence, usage, instances and
supplied props. `inspector.tsx` and `inspector_resize.ts` own the tab and sheet
interaction. Each shell root owns one `frame_registry.tsx` instance, so frame
identity, readiness, validated usage revisions and disposal cannot cross an
independent embedded viewer. Public-handle inspection and
`workspace_inspection.tsx` coordinate through the registry's inspection owner.
Workspace labels and host markers acquire the registry's single geometry
scheduler; a usage revision supersedes any unresolved measurement before fresh
evidence is read. Navigation and inspector resize drag state stays on the
owning shell root so independent embedded viewers cannot alter the host page or
each other. Embedded roots also own their flex containment and measure host
stage overlays against the current preview, keeping sibling viewers,
navigation and the inspector outside an overlay's bounds. Browser transport
remains behind `useViewerCapabilities`. The
[live capability contract](../../../../docs/protocol/mokly-live-capabilities.md)
defines route loading, revision fencing and export omission.

Before standalone hydration, stored disclosure and split-width preferences are
applied to the server DOM. A newer native disclosure activation then wins over
that stored value. The browser entry reads the resulting DOM into the store's
initial state and persists the adopted disclosure state; hydration or page exit
removes the temporary capture. Static catalogue resolution may finish after
document load, so native choices remain authoritative until hydration starts.
React therefore adopts the same attributes on
its first render instead of replaying preferences after hydration.

`previews.tsx` renders the one previous-version presentation a removed page and
a removed screen share: the "Showing previous version" label, the stage host
carrying the descriptor the React request lifecycle validates, and the shared
device chrome around captured screen views. It advertises a packaged address only when the accepted
public catalogue publishes one, so a delivery without that descriptor stays
quiet. The served stage holds the unavailable copy without a Retry control,
because a shell that never hydrates cannot honour that action; the first client
effect replaces it with the loading state and adds Retry only if its own request
fails. The request fencing lives in `use_removed_preview.ts`; it asks
`previews/presentation.ts` to fetch and validate the historical documents needed
by the selected views before reporting ready. Each loaded frame receives only a
script-disabled, viewer-origin `srcdoc`, with
`data-mokly-preview-source` naming the immutable snapshot address. The
viewer-owned guard cancels links and forms, scrolls same-document anchors
without native navigation, and restores the accepted presentation after any
later frame navigation. The copy and Retry contract comes from
`previews/copy.ts`.
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
