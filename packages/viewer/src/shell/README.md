# Shared Browse shell

These React components are the Browse shell tree: catalogue, stages,
navigation and inspector. `document.tsx` supplies the standalone document
envelope used through `@mokly/viewer/server`, and the same tree is hydrated in
the browser by Serve, export and React hosts, with host-owned slots as ordinary
children. The [viewer contract](../../../../docs/protocol/mokly-viewer.md#shell-tree-and-state)
defines the tree and its state model; the
[React Browse shell plan](../../../../plans/react-browse-shell.md) records how
Serve, export and the public viewer converged on this tree.

`nav.tsx` renders the catalogue column, `nav_rows.tsx` its folder groups as
native `<details>` that only browse, and `nav_leaf_rows.tsx` its leaves: links
carrying their entry-kind glyph, and a screen or component's variants as a
container the row's chevron button discloses, because a row cannot be both a
link and a `<summary>`. `nav_tree.ts` lists a folder's own document, page, or
use case as the folder's first child row, labelled `Overview` when its title
is the folder's title, and renders a folder whose own page is a screen or
component as that entry's row, whose container holds the variants and then
the folder's other members. A deleted variant whose non-variant parent
survives joins that container as a Removed row. `nav_tree.ts` records actual
attachment before removing the row from flat fallback, so a former parent that
is now a variant cannot make its historical child disappear and every removed
entry remains represented once. Current section nodes use the shared
folder-first comparator; flat removed rows use the combined ordering in the
[variant navigation contract](../../../../docs/protocol/mokly-variant-navigation.md).
Specs and Components keep independent section roots even when they reuse the
same folder paths. `filterHierarchy` orders each section again by the rows it
shows, applying the `order` each folder node carries, so a screen or component
that is its folder's own page sorts as a folder row in the other section.
Search compares a row's path, title, tags, and the titles of the folders at or
above it (`registry/folder_titles.ts`), never a display label such as
`Overview` or `· Removed`. `search_query.ts` owns that one search row, so row
visibility, Changes activation, and route reveals match the same text.
`crumbs.ts` derives breadcrumbs from the same tree: a folder with its own page
links to it, a visible folder without one becomes a button that
`nav_reveal.ts` resolves to the disclosures exposing that folder, and the
store's `revealFolder` opens them, clears only a hiding filter, opens the
drawer at narrow widths, and asks `nav_scroll.ts` to focus the folder row.
An embedded reveal proposes the cleared query as a whole; `nav_scroll.ts`
keeps the reveal pending until the host commits a selection that shows the
row, and gives up when a commit leaves it hidden.
`disclosure_keys.ts` derives section-scoped folder disclosure keys by matching
fixed prefixes and complete paths; display labels never enter a key. It rejects
empty path segments and every earlier key form on restore.
`disclosure_storage.ts` owns the v4 map codec and its storage key; early
capture, hydration, the shell store, and watched-reload recovery share its
validation. Earlier storage versions are never read, translated, or removed.
`routes.ts` resolves URL paths to current or retained manifest entries;
`target.ts` wraps a found entry as a route target without an extra routing
filter. The [folder contract](../../../../docs/protocol/mokly-folders.md)
owns the shared folder ordering and identity used by this shell.
`nav_changed.ts` names the changed mark's class, attribute and wording, so the
server row and each React store update use the same presentation contract;
`css_nav_changed.ts` draws the mark from `data-changed` and
`data-changed-variants` alone. `nav_model.ts` applies search and Changes
visibility to parents and their variant children. `changes_activation.ts`
owns Changes-filter activation for both standalone and embedded shells: an
aggregate-only parent selects its first visible changed variant, and a changed
destination selects its first changed view only when the current selection is
not already a changed entry. Later navigation within Changes keeps the sticky
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
component variant path or screen path, so every reader must
select the evidence that belongs to the preview; `css_workspace_marks.ts` draws
the dot and clips its wording.
The parallel `viewStates` map stores `{ viewport, colorScheme, state }` for each
ready view under the same key, while a missing key means per-view status is
unknown. `workspace_views.ts` resolves documents actually displayed after
Light fallback. `view_status.ts` returns status, eligibility, and evidence
provenance together; missing or partial matching evidence retains the selected
entry's fallback status and eligibility.
`workspace_context.tsx` owns one routed workspace and its resolved views for
the top-bar Appearance indicator and workspace. `workspace.tsx` consumes that
shared resolution on every viewport, scheme, component variant, or evidence
change and passes the effective scheme to controls and comparison presentation.
`use_comparison.ts` is the single owner of comparison mode: component sibling
navigation keeps that owner mounted, and the workspace reads its mode directly
so Props and highlighting remain read-only until Current is selected.

`css.ts` concatenates the standalone stylesheet. Split string modules preserve
its exact bytes. The package build scopes an embedded stylesheet separately and
uses packaged relative font URLs; its selector-aware transform maps document
selectors and shell-root `.mbk` selectors to the embedding scope without
rewriting class names. Standalone Serve/export retain their original CSS and
font delivery paths.

`catalogue.ts` owns pure display indexing. Its `byPath` index contains current and
removed entries whose paths are unique across both sets; an explicit snapshot
selects its exact removed record. Baseline repository access remains in the
CLI's `src/server/baseline_catalogue.ts`.
`store.tsx` and the focused `store_*` modules own standalone route/history,
selection, disclosure, drawer, details, recovery and scroll state. `routes.ts`,
`nav_model.ts`, `search_query.ts` and `entry_wording.ts` are deterministic
helpers shared by SSR and the live tree; `delivery.ts` validates static
deployment continuity before a read-model route transition.
`store_browser_actions.ts` owns DOM interaction and
`store_browser_urls.ts` owns provider-normalized URL policy. Frame documents
remain static while `frame_event_router.tsx` routes authenticated logical-link
events from visible sessions in the owning `frame_registry.tsx`. An unavailable
frame destination changes only an uncontrolled or standalone display;
controlled viewers report the frame error and wait for host-owned selection.

Static route parsing accepts the canonical slash, extensionless, and
`index.html` forms; the shared parser resolves each path through `byPath`. Historical
resolution binds that route to its published snapshot; an explicit query must
match, while an inferred identity is canonicalized into the URL. Static
delivery v3 carries only the page's canonical path, comparison URL, and
deployment identity; entry destinations come from the shared route helpers.

Authenticated frame navigation stays logical until `frame_event_router.tsx`
resolves its path through `byPath` and derives the canonical URL with `viewHref`.
Primary, modified, middle, and named-target activations therefore share the
same `/view/` destination. An unknown path installs the missing view only for
standalone/uncontrolled shells and is recoverable by any later selection;
controlled viewers emit an error and keep their display.
Search matches paths, titles, and tags only. Details omits derived route
and generated-path rows because the address bar and path chip already identify
the entry.

Snapshot selection is route-owned state as well as public selection state. One
validated query/parser/resolver carries it through SSR, hydration, controlled
hosts and history. Headings, crumbs, Details and previous-preview lookup consume
the resolved removed record and route.

`workspace_data.ts` describes shell data, while `workspace_usage_data.ts`
projects use and affected-consumer links. Its `entry` is always the exact routed
screen, component parent, or component variant; component routes retain their
parent schema separately for controls. The public viewer projects those
values only from validated catalogue records. Embedded bootstrap and workspace JSON use
canonical key ordering so their validated client projections retain the exact
server bytes during hydration. `comparison_views.tsx` renders React-owned frame
chrome around the snapshots from validated comparison metadata. The CLI
supplies its private live capabilities through typed server context.

`workspace_evidence_data.ts` selects an entry's catalogue or loaded comparison
record for Details; `workspace_evidence.tsx` combines its shared-impact paths
with retained dependency paths while keeping stylesheet exclusions separate.

A live entry-scoped fallback never derives cross-entry Usage from `omitted`
views: `use_workspace_data.ts` exposes loading until matching private evidence
is adopted and failed after a current read failure or rejection, rather than
publishing a partial or false-empty list.

Standalone full-document composition lives in `src/standalone`:
[`../standalone/bootstrap_types.ts`](../standalone/bootstrap_types.ts) owns the
wire shape and
[`../standalone/bootstrap_validation.ts`](../standalone/bootstrap_validation.ts)
validates it before selection. Serve's bootstrap contains the validated
entry-scoped public catalogue and shell delivery state. Static pages
carry a compact identity/revision reference and resolve the shared finalized
complete catalogue before `src/browser.tsx` hydrates that exact server tree.
The document receives pre-serialized script text; server rendering serializes
it once and later client renders preserve it verbatim. Live Serve places
complete private route evidence in a separate descriptor; the capability store
replaces the fetched page's scoped public bootstrap, source and optional private
workspace as one monotonic revision instead of accumulating per-route usage.
`use_workspace_data.ts` keeps one entry-owned workspace object so
matching evidence refreshes retain already loaded usage and local editor state.
In a live shell it trusts only the store's workspace bound to the current
request; the page-lifetime initial workspace seeds that first binding but is
never reused after navigation, so returning to the first entry shows Loading or
Failed until its own evidence is adopted.
The runtime-only scoped catalogue model, projection and strict reader back
browser hydration and entry/live evidence through one exact-scope boundary.
Complete live models, missing entry-owned usage and leaked out-of-scope usage
are rejected. Static external references retain their separate complete-model
resolution path. Capture validates each live page with the same strict reader
before replacing its scoped model with that external reference.
Evidence commits rebuild navigation sections and reconcile the current
disclosures and pre-filter baseline to exactly their new keys; initial restore
uses the same `disclosure_storage.ts` reconciliation with an explicit fallback.
Evidence-only refresh keeps surviving collapsed choices; route navigation owns
active-route reveal.
The `nav_rows.tsx` and `nav_leaf_rows.tsx` missing-key defaults remain defensive
for rendering without a store; mounted shells supply every current key.
Versioned historical selection adopts new evidence and becomes unavailable if
that exact snapshot disappears. A removed record without an explicit identity
can be adopted only while its complete metadata remains unchanged; otherwise
the existing document reload boundary preserves coherent preview bytes.
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
The [standalone bootstrap contract](../../../../docs/protocol/mokly-shell-bootstrap.md)
defines usage scope, strict readers, serialization and capture invariants.

Before standalone hydration, stored disclosure and split-width preferences are
applied to the server DOM. Disclosure helpers treat native `<details>` groups
and the button-controlled entry-variant lists as the same persisted state.
Folder identities follow the [folder contract](../../../../docs/protocol/mokly-folders.md#order),
and persisted values and watched-reload recovery follow the
[disclosure persistence contract](../../../../docs/protocol/mokly-disclosure-persistence.md).
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
hydrates. [`appearance_bridge.ts`](../standalone/appearance_bridge.ts) adopts
that theme and the body's effective
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

`diffs.tsx` owns the comparison band and stage; `comparison_toolbar.tsx`
renders the band's mode group, the Scroll together switch (a native checkbox
with `role="switch"`, shown in every diff mode including loading and failure)
and Refresh. `use_comparison.ts` requests, renews and fences the selected
comparison, while `comparison_presentation.ts` owns its request identity and
axes; `comparison_selection.ts` picks the views and snapshot addresses
the selection shows; and `use_comparison_documents.ts` presents every selected
pane document through the shared snapshot loader of the comparison's immutable
generation before the stage reports ready. Its framework-free core,
`comparison_documents.ts`, keeps one loaded comparison's presentations across
mode, viewport and scheme switches and discards them when Refresh, Try again, a
new generation, Current or navigation replaces the comparison; a failure shows
the existing failure copy with Try again. `comparison_views.tsx` renders one
section per viewport, sharing one last-scrolled version
(`comparison_scroll_owner.ts`) between them, and chooses `comparison_stack.tsx`
for Overlay and Difference (one chrome whose viewport holds the Before layer
and the blended Current layer) or `comparison_side.tsx` for Side by side and
for views missing a side. `comparison_chrome.tsx` picks the browser, phone or
bordered component frame, `comparison_viewport.tsx` renders the shared
viewport, its sticky device-sized box and range spacer, and
`comparison_frame.tsx` reuses `preview_frame.tsx` and the read-only guard for
each version, marked `data-mokly-comparison-frame` with `scrolling="no"`.

`comparison_scroll_sync.ts` is the per-section scroll controller behind the
interfaces in `comparison_scroll_types.ts`: it follows each layer document from
commit, measures it (`comparison_section_measure.ts` sizes every spacer to the
section's largest range and paints each canvas), writes each viewport's offset
to its documents, shifts a shorter document's frame by the remainder, adopts
scrolls it did not make, routes keys and anchors, and applies Scroll together
live. `comparison_layer_listeners.ts` attaches its one capturing `scroll`
listener, key listener and reader-action listeners to each pane document and
remembers the last pointer target. `comparison_scroll_mirror.ts` keeps each
viewport's settled offset, links Side by side viewports while Scroll together
is on, compares values rather than using timers, and owns `scrollInstantly`,
which every programmatic scroll uses so a smooth `scroll-behavior` cannot
animate it; `comparison_layer_document.ts` reads a layer document's range,
offset and canvas colour. `comparison_scroll_regions.ts` detects a document's
inner scroll regions and indexes them, `comparison_region_identity.ts` reads
authored names, ids, roles, accessible names and text fingerprints, and
`comparison_region_match.ts` is the pure four-rule matcher; none of them change
the document. `comparison_region_mirror.ts` collects regions and matches at
most once per measurement, reserves pairs, records each region's last offset
for the echo rule, and writes both axes at once. `comparison_scroll_keys.ts`
maps keys to page steps and `comparison_key_route.ts` finds the region a key
belongs to from the focused element or last pointer target, right-to-left
regions included; `comparison_region_reveal.ts` reveals anchors in their
enclosing regions, innermost first. `comparison_scroll_preference.ts` owns the
`mokly:comparison-scroll-together` value and its stored, in-memory and fixed
stores, and `use_scroll_together.ts` reads the one the comparison environment
supplies; the embedded viewer keeps its store above source replacement. No
module reloads a pane presentation when the switch changes. The
[comparison pane contract](../../../../docs/protocol/mokly-comparison-panes.md)
owns presentation and layout, and the
[scrolling](../../../../docs/protocol/mokly-comparison-scrolling.md),
[region pairing](../../../../docs/protocol/mokly-comparison-region-pairing.md) and
[Scroll together](../../../../docs/protocol/mokly-comparison-scroll-together.md)
contracts own the scroll behavior.

`previews.tsx` renders the one previous-version presentation a removed page and
a removed screen share: the "Showing previous version" label, the stage host
carrying the descriptor the React request lifecycle validates, and the shared
device chrome around captured screen views. It advertises a packaged address only when the accepted
public catalogue publishes one, so a delivery without that descriptor stays
quiet. The served stage holds the unavailable copy without a Retry control,
because a shell that never hydrates cannot honour that action; the first client
effect replaces it with the loading state and adds Retry only if its own request
fails. The request fencing lives in `use_removed_preview.ts`; it creates the
shared snapshot-presentation loader for the loaded generation with only the
`before` side enabled, then fetches and validates the historical documents
needed by the selected views before reporting ready. Each loaded frame receives
only a script-disabled, viewer-origin `srcdoc`, with
`data-mokly-preview-source` naming the immutable snapshot address. The
viewer-owned guard cancels links and forms, scrolls same-document anchors
without native navigation, and restores the accepted presentation after any
later frame navigation. The copy and Retry contract comes from
[`previews/copy.ts`](../previews/copy.ts).
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
