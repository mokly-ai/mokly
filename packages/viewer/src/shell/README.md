# Shared Browse shell

These React components are the Browse shell tree: catalogue, stages,
navigation and inspector. `document.tsx` supplies the standalone document
envelope used through `@mokly/viewer/server`, and the same tree is hydrated in
the browser by Serve, export and React hosts, with host-owned slots as ordinary
children. The [viewer contract](../../../../docs/protocol/mokly-viewer.md#shell-tree-and-state)
defines the tree and its state model; the
[React Browse shell plan](../../../../plans/react-browse-shell.md) records how
Serve, export and the public viewer converged on this tree.

`nav.tsx` renders the catalogue column, `nav_rows.tsx` its collection groups as
native `<details>`, and `nav_leaf_rows.tsx` its leaves: links carrying their
entry-kind glyph, and a screen's variants as a container the row's chevron
button discloses, because a row cannot be both a link and a `<summary>`. A
deleted variant whose non-variant parent survives joins that container as a
Removed row. `nav_tree.ts` records actual attachment before removing the row
from flat fallback, so a former parent that is now a variant cannot make its
historical child disappear and every removed route remains represented once.
`nav_changed.ts` names the changed mark's class, attribute and wording, so the
server row and each React store update use the same presentation contract;
`css_nav_changed.ts` draws the mark from `data-changed` and
`data-changed-variants` alone. `nav_model.ts` applies search and Changes
visibility to parents and their variant children. `changes_activation.ts`
owns Changes-filter activation for both standalone and embedded shells: an
aggregate-only parent selects its first visible changed variant, and a changed
destination selects its first changed view only when the current selection is
not already a changed route. Later navigation within Changes keeps the sticky
view axes; aggregate-parent redirection still applies. The shared typed query
parser applies each valid viewport or scheme independently and ignores invalid
or repeated values; the embedded host and standalone router consume the same
route result. `details_rows.tsx` owns the inspector's
metadata rows, including links between a screen and its variants and the
`Changed views` row.

`view_marks.ts` is the shared vocabulary for per-view change evidence: the two
axes that name a view, their canonical order and reader label, and the rule
that decides whether the theme and viewport controls carry a mark.
`workspace_views.ts` resolves the requested axes to the views actually shown,
including Dark-to-Light fallback, and carries the matching status, comparison
eligibility, and evidence provenance as one decision. `workspace_controls.tsx`
uses that effective scheme while retaining the requested scheme as the control
state, so navigation and controlled-host updates cannot leave stale indicators.
`workspace_views_data.ts` derives the changed views themselves, preferring a
ready comparison result and falling back to the lightweight screen-view
evidence a screen-only catalogue records. Workspace data keys those lists by
saved-variant id for components and entry id for screens, so every reader must
select the evidence that belongs to the preview; `css_workspace_marks.ts` draws
the dot and clips its wording.
The parallel `viewStates` map stores `{ viewport, colorScheme, state }` for each
ready view under the same key, while a missing key means per-view status is
unknown. `workspace_views.ts` resolves documents actually displayed after
Light fallback. `view_status.ts` returns status, eligibility, and evidence
provenance together; missing or partial matching evidence retains the
selected entry or saved variant's fallback status and eligibility.
`workspace_context.tsx` owns one routed workspace and its resolved views for
the top-bar Appearance indicator and workspace. `workspace.tsx` consumes that
shared resolution on every viewport, scheme, saved-variant, or evidence change
and passes the effective scheme to controls and comparison presentation.

`css.ts` concatenates the standalone stylesheet. Split string modules preserve
its exact bytes. The package build scopes an embedded stylesheet separately and
uses packaged relative font URLs; its selector-aware transform maps document
selectors and shell-root `.mbk` selectors to the embedding scope without
rewriting class names. Standalone Serve/export retain their original CSS and
font delivery paths.

`catalogue.ts` owns pure display indexing, including exact historical snapshot
resolution when current and removed entries share an id. Current content remains
the default only when no snapshot is selected. Historical
repository access remains in the CLI's `src/server/baseline_catalogue.ts`.
`details.tsx` shows source, generated paths, related docs and usage for routed
entries, but never shows their authoring dependency lists. Comparison details
from `workspace_evidence_data.ts` and `workspace_evidence.tsx` name only
rendered-resource reasons; comparison v4/v5 does not carry
legacy `sharedImpact` paths.
`store.tsx` and the focused `store_*` modules own standalone route/history,
selection, disclosure, drawer, details, recovery and scroll state. `routes.ts`,
`nav_model.ts`, `search_query.ts` and `entry_wording.ts` are deterministic
helpers shared by SSR and the live tree; `delivery.ts` validates static
deployment continuity before a read-model route transition. Frame documents
remain static while `frame_event_router.tsx` routes authenticated logical-link
events from visible sessions in the owning `frame_registry.tsx`.

Static route parsing accepts a provider-normalized extensionless path only when
its `.html` form names a published current route or an exact retained historical
route. Historical resolution binds that route to its published snapshot; an
explicit query must match, while an inferred identity is canonicalized into the
URL. A same-id `idRoutes` entry can never retarget history to current content.

Snapshot selection is route-owned state as well as public selection state. One
validated query/parser/resolver carries it through SSR, hydration, controlled
hosts and history. Headings, crumbs, Details and previous-preview lookup consume
the resolved historical record and route, never a colliding current-id lookup.

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
Versioned historical selection adopts new evidence and becomes unavailable if
that exact snapshot disappears. Identity-less legacy history adopts only an
unchanged removed record; metadata changes reject live adoption and preserve the
existing document reload boundary.
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
applied to the server DOM. Disclosure helpers treat native `<details>` groups
and the button-controlled screen-variant lists as the same persisted state.
A newer native disclosure activation then wins over that stored value. The
browser entry reads the resulting DOM into the store's initial state and
persists the adopted disclosure state; hydration or page exit removes the
temporary capture. Static catalogue resolution may finish after document load,
so native choices remain authoritative until hydration starts. React therefore
adopts the same attributes on its first render instead of replaying preferences
after hydration.

Appearance has the same explicit handoff with an earlier first-paint boundary.
`appearance-startup.js` runs before the stylesheet, resolves Auto/Light/Dark,
and refreshes the parsed control and frame sources before `src/browser.tsx`
hydrates. `appearance_bridge.ts` adopts that theme and the body's effective
scheme into the live shell, independently asking the store for matching preview
files. A light-only catalogue can therefore keep Light previews without
rewriting a Dark interface during hydration. Without the startup host, the
bridge leaves the selector hidden. Embedded roots skip the bridge and receive
`theme` from their host while retaining independent preview controls.
Standalone route installation sends scheme pins to that controller; it never
changes preview selection separately. A reader's choice wins over later pins
through navigation and browser history. Each preview wrapper records its actual
file's scheme for iframe media queries, native controls, device colors and
comparison backgrounds, including globally light-only catalogues. Startup
updates this frame value before changing a fragment source.
`css_preview_scheme.ts` owns every preview surface background and iframe
color scheme. Transparent content therefore keeps its selected Light or Dark
base in screen, page, component, historical and comparison frames, independently
of interface appearance. Layout styles leave those properties to this module.
After the bridge mounts, React's frame adapters exclusively own source changes;
the startup controller only reports the effective scheme, avoiding iframe
history entries during manual or automatic appearance changes. The frame-source
hook preserves initial markup and updates sources only for frames without an
active adapter; it must not race adapter-owned history-replacing navigation.
Display-only selection updates preserve manually collapsed filtered groups;
only changed search, tag or Changes filters reveal their matching groups.

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
`mbk-preview-switch` classes the design catalogue's stage stylesheet owns. The
Both-only rule reads the normalized `data-viewport` value on the live stage.
See [previews](../previews/README.md) for the client side.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).

During standalone hydration, the workspace adopts the server-rendered status,
comparison availability and change marks for its first React render. It then
recomputes that metadata from the active preview selection immediately after
hydration. The early appearance script already selected the preview files;
this metadata handoff preserves those frames and avoids rebuilding the shell
when stored Dark appearance differs from the server's initial Light evidence.
