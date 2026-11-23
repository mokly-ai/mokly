# Shared Browse shell

Status: Some host content cleanup errors reach `CatalogueBoundary` as catalogue failures. The [host content cleanup item](../../../../plans/follow-ups/host-content-cleanup-errors.md) owns that fix.

Serve, the static build, and React hosts render this same tree in the
browser.

## Branch name

The exported navigation fallback retains the known branch name.
The [presentation contract](../../../../docs/protocol/mokly-css-evidence-presentation.md#details-copy)
keeps the sentence during loading; an index without a `base` omits it.

## Scope

`comparison_selection.ts`
uses each side's original path for snapshot URLs, including moved variants.
`catalogue.ts` keeps each paired current entry's branch-point path in
`previousPaths`, read from the index's `previousPath`. No shell module
reads those pairs, follows a `variantOf`, or case-folds a path itself:
reference and parent resolution follow the
[branch-point lookup contract](../../../../docs/protocol/mokly-branch-point-lookup.md)
through one lookup.
`nav_moves.ts`
records that path on each row; under Changes a moved row reads
`<label> · Moved` in place of the changed mark, and under All it carries the
mark only when `materialChangedEntries` lists it. Inspect's Details rows add
a `Moved from` row after Source and a screen's Address, and the comparison
details name the previous path as the earlier side. A pure move is in Changes without changing, so workspace
statuses count material changes only and keep it Unmodified: the projection
sets `materialEntries` from each entry's `changes.kind`. The same lookup
contract owns
counterparts for workspace inputs, variants and nested component instances.

`catalogue_branch_point.ts` implements that pure lookup beside `createCatalogue`.
`branchPoints(catalogue)` is its one construction point: it indexes a catalogue
generation on first use and returns the same lookup while that index stays
installed, including when held details change. `resolve` requires an explicit before/after side and kind.
`parent` gives an eligible parent of a resolved variant or a stored title
without a link, and `parentOf` locates a current entry or removed record first.
`removedVariants(parent)` lists the removed variants whose parent resolves to
that entry, in record order. `previousPath` gives only accepted move pairs.
Results retain current entries or complete removed records. The lookup pairs
no counterparts: the entry detail already carries the paired input changes. Usage
links, Inspect's Variants, removed tree rows, workspace keys, the breadcrumbs
of the Path row, the Details rows and the public workspace all use it.
[`branch_point_guard.test.ts`](../../../../tests/branch_point_guard.test.ts)
fails when a shell or viewer module outside the lookup reads `previousPaths`,
follows a `variantOf`, or case-folds a path.

These React components are the Browse shell tree: catalogue, stages,
navigation and the right panel. The tree renders only in the browser:
`src/browser.tsx` mounts the standalone shell into the stub that Serve and
`build` deliver, and React hosts render it inside `MoklyViewer`, with
host-owned slots as ordinary children. The
[viewer contract](../../../../docs/protocol/mokly-viewer-selection.md#shell-tree-and-state)
defines the tree and its state model, and the
[shell delivery contract](../../../../docs/protocol/mokly-shell-delivery.md)
the data it reads.

`nav.tsx` reads the store and renders the catalogue column with
`@mokly/ui/catalogue-navigation`, whose tree `@mokly/ui/catalogue-tree` draws
from plain records: `nav_rows.ts` builds the sections and the folder groups,
which the package draws as native `<details>` that only browse, and
`nav_leaf_rows.ts` the leaves: links carrying their
entry-kind glyph, and a screen or component's variants as a container the
row's chevron button discloses, because a row cannot be both a link and a
`<summary>`. `nav_filter.ts` builds the All and Changes filter and the status
line. The package records interactive folder and section choices during
summary activation, before queued toggle events, and reports each through
`onDisclosure`. Search therefore receives the last choice as its pre-filter
baseline. Non-interactive summaries retain native behavior.
`nav_tree.ts` lists a folder's own document, page, or
use case as the folder's first child row, labelled `Overview` when its title
is the folder's title, and renders a folder whose own page is a screen or
component as that entry's row, whose container holds the variants and then
the folder's other members. A deleted variant joins the container of the
current parent the lookup resolves, including a moved or case-renamed parent,
as a Removed row. `nav_removed_variants.ts` records actual attachment before
removing the row from flat fallback, so a former parent that is now a variant
or another kind cannot make its historical child disappear and every removed
entry remains represented once. A removed page or document is a flat row.
Only Changes shows removed rows of any kind; All and search hide them. Current section nodes use the
shared folder-first comparator. Flat removed rows keep `removedEntries` order,
with each removed parent's variants directly after it, under the
[serialization contract](../../../../docs/protocol/mokly-catalogue-serialization.md#canonical-bytes).
Specs and Components keep independent section roots even when they reuse the
same folder paths. `filterHierarchy` orders each section again by the rows it
shows, applying the `order` each folder node carries, so a screen or component
that is its folder's own page sorts as a folder row in the other section.
`search_query.ts` implements the single [search rule](../../../../docs/protocol/mokly-folders.md#titles),
using resolved titles from `registry/folder_titles.ts`. Row visibility,
Changes activation and route reveals all use that shared query and row, and
`nav_rows.ts` counts each folder's child rows with the same visibility.
`home_summary.ts` uses each index entry array's length and a type-checked label
for every entry kind. The [shell layout contract](../../../../docs/protocol/mokly-shell-design.md#layout)
owns both rules.
`crumbs.ts` derives breadcrumbs from the same tree: a folder with its own page
links to it, a visible folder without one becomes a button that
`nav_reveal.ts` resolves to the disclosures exposing that folder, and the
store's `revealFolder` opens them, clears only a hiding filter, opens the
catalogue's sheet in the compact layout, and asks `nav_scroll.ts` to focus
the folder row.
An embedded reveal proposes the cleared query as a whole; `nav_scroll.ts`
keeps the reveal pending until the host commits a selection that shows the
row, and gives up when a commit leaves it hidden.
`disclosure_keys.ts` derives section-scoped folder disclosure keys by matching
fixed prefixes and complete paths; display labels never enter a key. It rejects
empty path segments and every earlier key form on restore.
`disclosure_storage.ts` owns the v4 map codec and its storage key; the
stored preferences the browser entry reads and the shell store share its
validation. Earlier storage versions are never read, translated, or removed.
`routes.ts` resolves URL paths to current or retained catalogue records;
`target.ts` wraps a found entry as a route target without an extra routing
filter. The [folder contract](../../../../docs/protocol/mokly-folders.md)
owns the shared folder ordering and identity used by this shell.
`@mokly/ui/catalogue-tree` names the changed mark's class, attribute and
wording, so every rendered row uses the same presentation contract, and its
stylesheet draws the mark from `data-changed` and `data-changed-variants`
alone. `nav_model.ts` applies search and Changes
visibility to parents and their variant children. `changes_activation.ts`
owns Changes-filter activation for both standalone and embedded shells under
the [lookup's consumer rule](../../../../docs/protocol/mokly-branch-point-lookup.md#consumers): an
unmodified container row selects its first visible changed tree entry, walking
the rows `catalogueNavSections` built in the order its list shows them, so a
removed variant attached under a moved member is reachable, and a changed
destination selects its first changed view only when the current selection is
not already a changed entry. Later navigation within Changes keeps the sticky
view axes; container redirection still applies. The shared typed query
parser applies each valid viewport or scheme independently and ignores invalid
or repeated values; the embedded host and standalone router consume the same
route result. `details_rows.tsx` resolves the lookups of Inspect's
Details rows, including links between a screen and its variants, the
`Changed views` row, and Related docs links, and `@mokly/ui/metadata-row`
draws them. A related doc links to its
document when it is a public `mock:<path>` reference or, in Serve and the
static build, the source path of a current document; a removed entry keeps
plain labels.

`view_marks.ts` is the shared vocabulary for per-view change evidence: the two
axes that name a view, their reader labels, the wording of the change marks,
and the id of the Appearance's mark; each toggle of the Frames filter names
its own wording's id. `frames_filter.ts` holds the Frames choice of the screens,
one choice of the shell that in-shell navigation keeps and a full page load
resets to every frame, and the rule that marks a toggle while it hides a
changed view. A use case keeps its own choice in `use_case_choice.ts`.
`workspace_views.ts` resolves the views that the filter shows on the wide
canvas, or the compact layout's picked frame, to the views actually shown,
including Dark-to-Light fallback, and carries the matching status,
comparison eligibility, and evidence provenance as one decision.
`inspect_frames.tsx` passes the marks, their ids, and their wording to
`@mokly/ui/frames-filter` at each render, so navigation and controlled-host
updates cannot leave stale indicators.
`public_workspace_views.ts` derives the changed views themselves from
the published catalogue's ready per-view comparisons. Workspace data keys
those lists by component variant path or screen path, and
`workspace_views_data.ts` reads the list of the shown selection, so every
reader selects the evidence that belongs to the preview;
`@mokly/ui/change-mark` draws the dot and clips its wording.
The parallel `viewStates` map keeps each ready view's axes and index
`comparison`, including `kind` and `eligible`, in index order under the same
key. A missing key means per-view status is
unknown. `workspace_views.ts` resolves documents actually displayed after
Light fallback. `view_status.ts` returns status, eligibility, and evidence
provenance together. It combines the shown comparisons in Changed, Added,
Removed, Unmodified order and uses the chosen comparison's eligibility.
Missing or partial matching evidence retains the selected entry's fallback
status and eligibility. `publicWorkspace` sets
`affectedComparison` when the routed entry's detail marks it
comparison-eligible and names the changed components that affect it, in or out
of Changes. `workspace_views.ts` then keeps the comparison eligible for each
shown view that reads Unmodified while its usage holds one of those
components, so a pure move, a component variant, and an entry whose other
views changed compare as an affected-only entry does.
`workspace_context.tsx` owns one routed workspace and the views that it
shows. `workspace.tsx` consumes that shared resolution on every change of the
Frames choice, the selection's viewport and scheme, a component variant, or
the evidence, and passes the effective scheme to the comparison
presentation.
The comparison holds one generation for each row that it demands, under the
[selected comparisons contract](../../../../docs/protocol/mokly-selected-comparisons.md):
each row of the shown frames that `useComparison` receives, a screen or one
row of a component's variant set, or without frames the routed entry's row
alone. `workspace.tsx` passes the canvas's frames that compare. A removed
component or variant has no live frames, so it passes none, and the removed
row compares alone. `comparisonFrames` in `comparison_eligible_frames.ts`
gives the shown frames whose rows compare under the
[screen controls](../../../../docs/protocol/mokly-changes-controls.md#screen-controls):
the row's shown views are eligible, or a shown view that reads Unmodified uses
a changed component that the row's own detail names. `comparisonOffered` in the
same file gates the compare modes, the route's comparison intent, and the
Changes tab of an entry that Changes does not list: a variant set with live
frames offers them while one of its shown rows compares, whichever row the
route names, and a screen, or a removed component or variant, while its
routed views are eligible. A row that does not compare keeps its live frames
while a mode shows. `comparison_presentation.ts`
turns the frames into the demand, with one key for each row: each row with the
axes of its frames, or in Side by side the row of the compared frame alone.
Without frames, the routed row is keyed on the selection's axes.
`comparison_request.ts` establishes one row's generation root: a pinned
catalogue's advertised root without a request, or the root that Serve's
selection endpoint redirects to, which a HEAD request renews.
`comparison_row_lifecycle.ts` runs each demanded row on its own. A row without
a generation gets one request, a loaded row whose key changes renews first,
and a key change while the row's work runs keeps that work, whose completion
applies the row's latest key. In a static build, the rows that start together
share one deployment check (`comparison_deployment_check.ts`). A row that
leaves the demand aborts its work and keeps its generation, which renews when
the row returns. A failed row keeps its failure for its key while the other
rows continue; `retry` requests one row again, the routed row by default, and
`refresh` every demanded row. `comparison_row_snapshot.ts` shows the demanded
rows to the controller, for the demand of each render: `generations`, by
entry id, with the rows that still load and the rows that failed, keeps its
identity while nothing in it changes, and the presentation follows the latest
mode and axes once every demanded row has settled. A row whose key a render
changes reads as loading in that render, so no document of its new frames
loads before its renewal. `use_comparison_documents.ts` presents and aborts
each row's documents on its own, starts nothing new for a row that renews,
reads a failed row's failure, and keeps the accepted presentations while
`generations` is absent, as Inspect makes it, so a return shows the mode with
no new load. A failed row shows the comparison failure with Try again on
its own frames while the other rows compare; Current remains available.
Every failed comparison uses the details sentence "The comparison is
unavailable.". The shell never shows server or browser error text there.
`use_comparison.ts` owns the chosen comparison mode through
`comparison_mode.tsx`, which gives host inspection and markers the mode that
the canvas shows: the chosen mode while Changes is the selected tab, and
Current while Inspect is. Component sibling navigation keeps that owner
mounted. The workspace reads the same shown mode, so Props and highlighting
are read-only only while Changes shows a compare.
`views.tsx` keys the workspace with `workspaceKey`, the parent the lookup
resolves, so a removed variant of a moved or case-renamed parent opens in its
siblings' workspace and keeps their mode, and every row's generation. The
mode owner also includes the index revision, so a publication returns an
active comparison to Current. Current, a new owner, a new comparison
environment and unmount cancel every row, and a late response changes nothing.
`comparison_intent.ts` applies a route's comparison intent once. The store
counts route installations and keeps the installed route's intent; the
routed workspace settles it when `comparisonEligibilityKnown` first reports
final eligibility, and only while the workspace offers its compare modes it
opens Side by side and selects the Changes tab, where the canvas shows that
mode. Otherwise the intent leaves the selected tab as it is. A
publication keeps the count, so it cannot reopen the comparison, and the mode
owner never reads the address.

Every element of the shell is a `@mokly/ui` component under
`packages/ui/src`: props in, callbacks out, no store. Each module here that
renders is a container. It reads the store, the contexts, and the frames, and
it renders package components with props and callbacks, as `appearance.tsx`
reads the identifier and workspace contexts and renders
`@mokly/ui/appearance-selector`. `top_bar.tsx` and `nav.tsx` render the top
bar and the catalogue navigation the same way, and `head.tsx` gives a view's
title and folder crumbs. `tags.tsx` renders the search field's tag picker
with `@mokly/ui/tag-picker` and each tag chip of the Details rows with
`@mokly/ui/tag-chip`. `right_panel.tsx` renders the right panel's tabs with
`@mokly/ui/panel-tabs`, `workspace_inspect.tsx`, `target_panel.tsx`, and
`inspect_head.tsx` render Inspect with `@mokly/ui/inspect-panel`,
`@mokly/ui/metadata-row`, and `@mokly/ui/inspect-selection`, and
`inspect_frames.tsx` renders `@mokly/ui/frames-filter`.
`selection_overlay.tsx` draws the canvas selection with
`@mokly/ui/canvas-selection`, and `workspace_selection_view.tsx` the compact
layout's pill with `@mokly/ui/selection-pill`. `views.tsx` and
`workspace.tsx` render the status beside a title with
`@mokly/ui/change-status`. Inspect's Props, Usage, and Components render
`@mokly/ui/prop-field`,
`@mokly/ui/controls-panel`, `@mokly/ui/props-panel`, `@mokly/ui/usage-list`,
`@mokly/ui/instance-tree`, and `@mokly/ui/comparison-evidence`, from records
that their containers build, and the preview shows the status of an edit's
render with `@mokly/ui/edit-status`. The controls' wording of
`component_controls_copy.ts` reaches them as props. The preview's containers
render `@mokly/ui/canvas-stage`, `@mokly/ui/canvas-frame`,
`@mokly/ui/canvas-missing-view`, `@mokly/ui/canvas-state`,
`@mokly/ui/canvas-previous-version`, `@mokly/ui/preview-frame`,
`@mokly/ui/preview-state`,
`@mokly/ui/canvas-comparison`, `@mokly/ui/swipe-divider`,
`@mokly/ui/comparison-stage`, `@mokly/ui/comparison-pane`,
and `@mokly/ui/empty-state`. Each `<iframe>` element
is `PreviewIframe` of `@mokly/ui/preview-frame`: a container passes its `ref`,
its `src` or `srcDoc`, its `key`, and its data attributes, and it keeps the
mount hooks, the sources, the read-only guard, and the scroll controllers.
`views.tsx` renders the main
region of `@mokly/ui/shell-layout`, `workspace.tsx` lays out the workspace
with `@mokly/ui/workspace-layout`, and `embedded_viewer.tsx` lays out an
embedded root and its host slots with `@mokly/ui/embedded-layout`, which
places each slot's content and never reads it. `embedded_viewer.tsx` gives
the `changesStart` content to the right panel through the provider of
`changes_start.tsx`, and the Changes tab places it; the standalone shell has
no slots. `right_panel.tsx` renders
the right panel with `@mokly/ui/floating-panel`, and `sheets.tsx` the compact
layout's dock with `@mokly/ui/canvas-dock`, and the catalogue's sheet state
that both roots pass to their layout, and the views render the compact layout's entry bar
with `@mokly/ui/entry-bar`. The standalone shell's root
and the loading, failure, and version states of both roots render
`@mokly/ui/shell-layout`, and the highlight labels of the workspace and of a
host's inspection render `@mokly/ui/highlight-label`.
`catalogue_boundary.tsx` wraps the ready shell of both roots. A document of the
supported version that the shell cannot render, an entry detail included,
moves the root to its failure state with Try again. A value that host code
throws passes on to the host. Both
inspection layers
draw one `@mokly/ui/highlight-mask` over each highlighted frame from the same
boundary snapshot as their labels, for same-origin and cross-origin frames.
The mask clips to the visible frame.
A local ESLint rule
rejects every intrinsic JSX element in `packages/viewer/src`, so a container
renders only package components, fragments, providers, and portals. Text
that the shell derives from catalogue data stays here and reaches the
components as props, such as the sentences of `entry_wording.ts` and the
change-mark wording of `view_marks.ts`. The design library and the
artboards under `examples/basic/specs/design` render the same package
sources, so a change to a package component also changes its design mockups.

The shell holds no style rule. `@mokly/ui/styles.css` holds every rule of the
shell, in the cascade order that `packages/ui/src/styles.css` lists: the
theme, the shared controls, the components, then the layout and its
responsive rules. The viewer build writes the standalone `shell.css` and the
embedded `styles.css` from that stylesheet and the `@font-face` rules of the
shell fonts, Geist and Geist Mono.

The theme gives the stub's document class the Auto appearance before the
bundle runs. The standalone shell sets its appearance, scheme, and state marks
on its own root, as an embedded root does, and never on `body`. The appearance
state also supplies the appearance on `<html>`, so the stub page around the
shell takes the same appearance as the root. The
embedded stylesheet uses packaged relative font URLs and keeps the
fallbacks that let a host's accent value inherit. It needs no `@scope` block,
because no package rule reaches the host page or host slot content. The
standalone shell keeps the original font paths.

`catalogue.ts` indexes the generated records of `ShellCatalogueReadModel`.
Its `entries` holds current records, and `removedEntries` holds `ShellRemovedEntry`
records. Its `byPath` index contains both sets, whose paths are unique across them.
An explicit snapshot selects its exact removed record. `createCatalogue` builds
these lookups, tags, Dark availability, and accepted move pairs once per index.
`registry/catalogue_hierarchy.ts` reads the index `tree` for folders, titles,
hidden flags, and ancestor titles. `filterHierarchy` derives and orders each
navigation section. The catalogue's `publicModel` joins held details separately.
A detail commit replaces that model and retains the index lookups and sections.
`tag_selection.ts` captures the open picker before a tag changes the search state.
A tag of Inspect's Details rows then returns focus to the toggle in its own
shell. Picker
chips keep the focus return of `@mokly/ui/tag-picker`.

`store.tsx` and the focused `store_*` modules own the shared route,
selection, disclosure, sheet, right panel tab, Frames choice and scroll
state. Every container
renders under `ShellStoreProvider` and reads that state through
`useShellStore`, also in tests. `store_browser.ts`
owns standalone history, and `store_host.ts` owns host selection commits.
`store_routes.ts` installs each route's display for both roots.
`store_interactions.ts` binds both roots to clicks and Escape. It dismisses
the tag picker on an outside click, including a click outside an embedded
root. It returns picker focus only when the panel held focus.
`search_keys.ts` binds the search keys of the
[shell design](../../../../docs/protocol/mokly-shell-design.md#layout) while
the top bar shows: ⌘K and Ctrl+K from anywhere, and `/` outside a text field.
It listens on the document of a standalone shell and on an embedded root
only, so the host page keeps its own keys. A key that acts loses its default
action and moves focus through the `TopBarHandle` that `top_bar.tsx` holds.
A search key that a canvas frame's document forwards arrives as the
`mokly-shell-key` event of `canvas_input.ts` on the same target, and it moves
focus the same way. The frame has already cancelled its default action.
`useSearchShortcut` makes the field's key hint name `⌘K` on Apple's platforms
and `Ctrl K` on the others.
`routes.ts`,
`nav_model.ts`, `search_query.ts` and `entry_wording.ts` are deterministic
helpers. `selection.ts` owns selection changes and query equality.
`store_browser_actions.ts` owns standalone link navigation, and
`store_browser_urls.ts` owns provider-normalized URL policy. Frame documents
remain static while `frame_event_router.tsx` routes authenticated logical-link
events from visible sessions in the owning `frame_registry.tsx`.
`frame_mount_hook.ts` and `frame_session_usage.ts` retain mount-scoped usage
adoption, including the mainline race fix when mounting finishes after a newer
usage revision arrives. An unavailable
frame destination changes only an uncontrolled or standalone display;
controlled viewers report the frame error and wait for host-owned selection.

`data_controller.ts` owns one shell root's data outside React: the installed
index, the entry details whose fences accepted them, the publications of the
event stream, and the live descriptor. Static sources also check the deployment
file during navigation. `data_requests.ts` lists the details a route renders
from. A current component variant requests its own detail and its parent's
detail. A component's route, the parent's or a variant's, also requests the
detail of each current saved variant of the set, whose rows the canvas shows
with their usage. The catalogue's hierarchy lists those variants, as
`public_variants.ts` reads them, so the module follows no `variantOf`. A
publication refresh builds the hierarchy of its new index. A use case also
requests each step screen's detail. The
module loads
each detail under the fences of the
[shell delivery contract](../../../../docs/protocol/mokly-shell-delivery.md#fetch-and-fences),
and loads a publication refresh; `data_refresh.ts` runs one such refresh at a
time for the controller and keeps the route whose refresh failed.
`data_commit.ts` adopts a new index and its details as one snapshot and
rebinds the route and the disclosures to it;
`data_store.ts` binds the controller to the store, and `data_context.tsx`
exposes the routed delivery, the route-detail reload action, and the live render
capability. A failed live removed-preview renewal
uses that action to discard the held detail and request it under the same
fences. The catalogue keeps its index lookups while the detail loads. The stage renders
the frames once the routed details arrive; until then `stage_delivery.tsx`
shows the loading state, or the unavailable state with retry, which
`@mokly/ui/preview-state` draws. A use case
shows the unavailable state, also after a failed publication refresh, only
after each of its details has arrived, failed, or been replaced, because a
detail that still loads can show another deployment. Until then the stage
keeps loading, while an embedded host still hears of each failure at once. A
detail of
another deployment is not a failed load: the controller stops every load,
ends the live connection as a disconnect does, and ignores later failures,
the source reports the change once, and a route that
still waits has the `replaced` delivery. Its stage keeps the loading state
until the new data arrives, from the standalone shell's full page load or from
the `index` that an embedded host supplies. The element generation of `frame_source_hook.ts` advances
only when a frame's `documentKey` changes at the same source, so a publication
reloads only the frames whose document changed. Saved component view records
supplied by prop controls keep their index `documentKey`. Only a temporary
render URL bypasses that key.

A use case stands on the canvas at every width, under the
[use-case rule](../../../../docs/protocol/mokly-shell-canvas-stage.md#use-case)
of the canvas stage contract: `stages.tsx` routes it to
`canvas_use_case.tsx`, which gives `canvas_stage.tsx` one section of step
frames in one row. `canvas_use_case_frames.ts` holds the step frames, one for
each step in step order, each labelled `{number} · {title}`, as the compact
frame picker lists it. Every step frame shows its step screen's view of the
use case's own Frames choice, apart from a screen's frames and from the
selection's preview scheme: Desktop and Light at and above the layout
breakpoint, and Mobile and Light below it. A step whose screen has no dark
view of that viewport keeps its Light view under Dark, and its label says so.
`canvas_use_case_frame.tsx` mounts each step frame with the mount hook of
`stage_frame.tsx` under the step's own frame identity, so instance events and
markers carry the step's index, and only the first step's frame opens at the
route's fragment. The step's link, which opens its screen, has the accessible
name `{step title}, {screen title} screen`. In the compact layout the canvas
shows one step frame at a time: `canvas_use_case_pick.ts` keeps the pick of
the target view, the first step's frame when a use case opens, and the entry
bar's picker lists the step frames and names the use case's status. The other
step frames stay mounted out of the section.

`layout_breakpoint.ts` holds the layout breakpoint of the
[canvas frames contract](../../../../docs/protocol/mokly-shell-device-chrome.md#responsive-behavior)
as one media query, narrower than 900px, which every shell and viewer rule and script
reads, so the floating panels, their sheets, the dock and the entry bar
switch at the same width. It also holds the 1180px panel step, below which
the floating panels narrow. The `@mokly/ui` stylesheets cannot import these
queries, so they repeat them, and the viewer's
[styles test](../../tests/styles.test.ts) holds them to these.

Both roots draw the Canvas layout: the standalone shell and an embedded root
pass `useCanvasLayoutParts` of `sheets.tsx` to their layout, the catalogue's
sheet, the dock and the catalogue's width. The store holds the open sheet,
one at a time, and whether it is expanded; a navigation closes the
catalogue's sheet and keeps the right panel's sheet while an entry shows,
and a sheet's close control returns focus to the dock's control that opens
it. The catalogue's width is the reader's choice or the starting width of
`canvas_layout.ts`, 252px or 224px below the panel step, and a double click
on the separator forgets the choice. `nav.tsx` passes the index's `base` to
the catalogue's foot. A target view puts its tabs in the right panel of
`right_panel.tsx`: Inspect, and Changes where the entry has it. A screen's or
a component's workspace has Changes while Changes lists its entry or while
the workspace offers its compare modes. `workspace_panel.tsx` and
`target_panel.tsx` give an entry's Changes tab to `changes_tab.tsx`, and
`comparison_canvas.tsx` draws the compare on the
canvas. The dock's Fit refits the canvas that `canvas_stage.tsx` registers in
`root_context.tsx` while it shows, also during a compare, and it hides while
the state of a comparison covers the canvas.

`stages.tsx` shows the routed screen, component, page or document on the
canvas of `@mokly/ui/canvas-stage`, under the
[canvas stage contract](../../../../docs/protocol/mokly-shell-canvas-stage.md),
in both layouts. `canvas_layout.ts`
watches the breakpoint, and a render without a window is wide. `workspace.tsx`
asks `workspace_canvas.ts` for its entry's frames, which reads
`canvas_frames.ts`: a screen's frames, Desktop
beside Mobile and Light above Dark, or a component's variant set, a row for
its own example and then one for each current saved variant, Light beside
Dark, each with the row's desktop view. The Frames filter keeps the columns
and the rows that it shows on the canvas; the other frames stay mounted with
their documents but take no room. In the compact layout `canvas_compact.ts`
keeps the picked frame alone: a screen's frame of the selection's viewport
and scheme, with Both read as Mobile, or its first shown frame while the
filter hides that one, or a variant set's selected frame, while a set
without a selected frame shows its whole set.
The entry bar's frame picker lists the shown frames of the model, a screen's
Mobile frames first, and a pick sets the selection's viewport and scheme or
opens the picked row's entry in its scheme through the store's `openEntry`,
as one selection change, so a controlled host hears one proposal. The other
frames stay mounted out of the
section, and the picked screen frame's label leads with the entry's slug. A
live edit renders the view of each shown frame of the edited screen or
row (`canvasEditContexts`), one context for each viewport and scheme: every
shown frame on the wide canvas, and the picked frame in the compact
layout, so a pick of another frame changes the contexts and cancels
the old render. A component's own route in the compact layout shows its
whole set, so an edit of its row renders both of its frames.
`withEditPreviews` gives the frames the edit's renders. The workspace passes
the frames with the stage, and its highlights draw on every shown frame. `canvas_workspace.tsx` mounts each frame
with `canvas_live_frame.tsx`, which shares the mount hook of `stage_frame.tsx`
and names its frame `{title} — {viewport} — {scheme}`, with
`data-workspace-frame`, `data-workspace-color-scheme` and, on a component
frame, `data-workspace-variant`. A route's fragment opens the routed entry's
frames at it, and not the other rows of a variant set. Once each document of
a component frame is ready, the mount hook's `onReady` hears of it, and the
frame asks the mounted frame's `contentBox` once; `componentFrameSize` of
`canvas_frame_size.ts` turns the box into the frame's size, the document's
own size with its fractions, which the size tag rounds. An adapter
without the measurement, a failed measurement, and a document without
content keep the desktop size, and a measurement that ends after the frame
loads another document is dropped. A fitted canvas refits to the measured
frames. Each live canvas frame, a screen's, a component's or a reading
frame, mounts with the adapter's canvas input: the mount hook's
`onCanvasInput` receives it with the frame element, and the
`useCanvasFrameInput` hook of `canvas_frame_input.tsx` routes it through
`CanvasControlContext`.
`canvas_input.ts` maps a point of the frame's viewport to the page through
the frame's box and scale: ⌘ or Ctrl with the wheel and a pinch zoom the
canvas about that point with the handle's `zoomAt`, and a zoom key runs
its command. Escape and the search keys belong to the shell, not to the
canvas: `useCanvasFrameInput` sends each from the frame element as a bubbling
`mokly-shell-key` DOM event, which `canvas_input.ts` owns, so
`use_canvas_selection.ts` and `search_keys.ts` hear it on the same target as
their own keydown listeners.
While the document reports keyboard focus, the frame's
`focusVisible` draws its focus glow; `canvas-blur`, a focus without
`visible`, and the end of the document's mount put the glow out, since the
mount hook sends `canvas-blur` when it disposes of or replaces the mount.
`canvas_reading.tsx` shows a page or a Markdown document as one reading frame,
named by its source file, through the mount hook of `document_stage_frame.tsx`.
A Markdown document without a dark render keeps its light document under
Dark, and while the catalogue has a dark axis its reading frame's label adds
`Light only` after the file name. `canvas_stage.tsx`
gives the section the head band's title, path chip copy and status, binds the
canvas's keys on the whole document of a standalone shell and only on an
embedded root while the canvas shows, and asks the registry's geometry for one
refresh per animation frame after each pan or zoom, which fire no scroll or
resize event. The canvas clips the frames and their highlights. The frames'
stage is the canvas stage's invisible box, the canvas between the floating
panels and above the zoom pill, from `stageRef`, so a marker under a panel is
cut at the panel's edge, and one fully under it is hidden. A compare mode
draws on the canvas's frames, so the canvas keeps its pan, zoom, Fit and
keys; while the state of a comparison covers the canvas, its keys stop.

Static route parsing accepts the canonical slash, extensionless, and
`index.html` forms; the shared parser resolves each selection through
`catalogue/entry_selection.ts`. Historical
resolution binds that route to its published snapshot; an explicit query must
match, while an inferred identity is canonicalized into the URL. Entry
destinations come from the shared route helpers.

Authenticated frame navigation stays logical until `frame_event_router.tsx`
resolves its path through `byPath` and derives the canonical URL with `viewHref`.
Primary, modified, middle, and named-target activations therefore share the
same `/view/` destination. An unknown path installs the missing view only for
standalone/uncontrolled shells and is recoverable by any later selection;
controlled viewers emit an error and keep their display.
Inspect's Details rows omit derived route
and generated-path rows because the browser's address bar and the Path row
already identify the entry.

Snapshot selection is route-owned state as well as public selection state. One
validated query/parser/resolver carries it through the first render,
controlled hosts and history. Headings, crumbs, Details and previous-preview lookup consume
the resolved removed record and route.

`workspace_data.ts` describes shell data. Its `entry` is always the exact
routed screen, component parent, or component variant; component routes retain
their parent schema separately for controls. A screen or component parent reads
its lists from its own detail. A current component variant reads Used by and
Affected from its parent's detail, while its own detail supplies its other
workspace facts. Every value is projected only from the installed index and
detail records: every catalogue of a delivery carries its published records.

`workspace_evidence_data.ts` merges an entry's own reasons, which
`publicWorkspace` reads from the routed entry detail's `reasons`, the selected
screen's or variant's projected and live view evidence, and a loaded
comparison by path and rule key, so Current and a loaded comparison show the
same facts once. It takes the ignored content ids from each shown view whose
evidence is ready, then from a loaded comparison's views, and lists each id
once. An `unchanged` view adds none. `workspace_evidence_merge.ts` clears held
reasons that a newer publication no longer carries.
`workspace_stylesheet_evidence.ts` turns that evidence into
one item per changed file, with the contract's outcome sentences in order: own
component rules, page selectors, unresolved rules, or else the full matched
styles. `@mokly/ui/comparison-evidence` draws each file once with its
sentences and selector lists nested in its item, like the approved card.
`entry_wording.ts` declares each kind's nouns once and builds the kind's
evidence sentences, status lines and pane labels from them. A component's
sentences name the shown variant, while its file list and its own rules name
the component.
`evidence_details.ts` builds the files and exclusions records, so
`workspace_evidence.tsx` and `page_evidence.tsx` pass the same facts to
`@mokly/ui/comparison-evidence`, which draws the shared heading and block.
`reason_sentences.ts` words each reason, `workspace_evidence.tsx` decides
which facts show, and the package follows the designs' order: the reason
sentences right after the heading and a moved entry's earlier side, then the
files and exclusions, the paired prop values, and the changed components. The
ignored content, the shared-component sentence, the saved props block, which no
design places, and the no-changes line follow, in that order.
`workspace_evidence_data.ts` shows the shared-component sentence, which
`entry_wording.ts` words for a screen or a component, in place of
the no-changes line when Changes does not list the routed entry and changed
components affect it, by the facts of `../review/shared_impact.ts`: the
detail's related components or a component-owned record on a shown view.
`comparison_selection.ts` gives an unchanged view its "Components this screen
uses changed" pane heading when that view keeps a component-owned record, or
when its usage holds a changed component that the detail names:
`workspace_context.tsx` collects those views with `viewsUsingComponents`. The heading names
the branch point only when its name is known; an empty or blank name leaves the
heading alone. An index without a
`base` has no name, because `shellContext` supplies an empty one, so its
comparison details keep the rest of the evidence without that sentence. The
comparison details of a Changes tab leave the sentence out, because the
Compared rail names the branch point. `workspace_data.ts`
passes the shell's known name to `publicWorkspace`, so a workspace keeps the
sentence while its entry detail loads. The workspace projects the selected
views' `resourceEvidence` from the held entry detail through
`public_workspace_views.ts` and `../review/view_evidence.ts`. A
whole-document page has no workspace: `page_evidence_data.ts` reads its status
from the index record and its evidence record from the page's entry detail,
and `page_evidence.tsx` passes them with the page wording to
`@mokly/ui/comparison-evidence` in the page's Changes tab, or in its Inspect
while the Changes filter does not list the page. `views.tsx`
shows that status beside the page title. In the Changes tab of a use case, a
Markdown document, or a removed page or document, `target_evidence.tsx`
gives the sentences of the reasons of the entry's held detail, which
`public_reasons.ts` keeps for a record that Changes lists, and a use case's
`Changed step:` lines from `changed_steps.ts`: one for each step whose
screen a `screen` reason names, by the step's title or else its screen's.

An entry detail that is not held carries `omitted` usage, and no list is
derived from it. `use_workspace_data.ts` exposes loading until every detail
the route needs is accepted. A current component variant therefore waits for
its own and its parent's detail. It exposes the failed state with retry after a
failed or rejected load, rather than publishing a partial or false-empty list.
It keeps one entry-owned workspace object, so a publication that replaces the
details keeps loaded usage and local editor state. Its `detailDelivery` also
holds back the Props fields in `workspace_props.tsx`, which shows `Loading
props…` or the failed state with retry until the route details bring their
declared order, so the fields never appear in the index's name order and then
move.
`workspace_usage.tsx` keys each Usage row
by its entry and removal state only, so a publication that changes a row's
comparison eligibility keeps its link element and the focus on it. Its
`usageHref` opens an Affected screens consumer, or a removed one, in Side by
side when the linked view is eligible. An Added consumer opens Current
because it has no base side. A Used by link opens Current.

Standalone composition lives in `src/standalone`: `shell.tsx` loads the index
from the stub's origin, shows the loading, failed, and version states, and
renders the shell chrome; `data_source.ts` reads the index, deployment file,
and detail routes,
and `live_source.ts` the live descriptor, the event stream, and the render
route of Serve. A publication commit rebuilds the navigation sections and
reconciles the current disclosures and pre-filter baseline to exactly their
new keys; initial restore uses the same `disclosure_storage.ts`
reconciliation with an explicit fallback. A publication keeps surviving
collapsed choices; route navigation owns active-route reveal.
`nav_rows.ts` and `nav_leaf_rows.ts` read each disclosure from the store,
which holds every current key, because it builds its disclosures from the
same sections. A removed-entry route whose snapshot record leaves a refreshed
index shows the missing state.

`workspace.tsx` coordinates the React workspace without owning transport or
frame internals. `component_controls.tsx` owns cancellable temporary prop edits,
and `component_control_fields.tsx` derives each control's field, which
`@mokly/ui/prop-field` lays out as a row, its name in
a label column and then its value, help, and error, as the
[controls design](../../../../docs/protocol/mokly-component-controls-design.md)
draws them. Numeric fields use the effective bounds and step of the index's `controls`.
`control_numbers.ts` aligns those bounds with the HTML input's zero-based step.
The focused `workspace_*` containers turn evidence, usage, instances and
supplied props into the records of Inspect's sections, and
`@mokly/ui/panel-tabs` owns the keys of the right panel's tabs.
`use_canvas_selection.ts` and `canvas_selection.ts` hold the canvas
selection under the
[selection contract](../../../../docs/protocol/mokly-viewer-selection-canvas.md):
in Inspect, a click on a frame selects the innermost instance under the
pointer, a click that follows a link selects nothing, a host pick takes the
click in either tab, and the empty canvas and Escape clear the selection.
Escape acts on the whole document of a standalone shell and only on an
embedded root, and Highlight components and a host pick take it first. An
Escape that a canvas frame's document forwards arrives as the
`mokly-shell-key` event of `canvas_input.ts` on the same target, and it clears
the selection under the same rule. A
frame's session tells the selection when its document is replaced or the
instance leaves its ready usage. A request to show the selection is an
event: each explicit choice and each route's instance counts once, and
Inspect scrolls to its Selection section at each count, so a usage revision
never opens or scrolls it. `workspace_picks.ts` joins the selection to the
canvas: in the compact layout a variant set's selected frame is the picked
frame, which follows the selection's scheme, and a pick of another row
opens that row's entry. `root_context.tsx` shares the root ref, drag
state, focus targets, host slots, the dock's controls, named scroll regions,
and the shown canvas. Containers use package refs for focus
and measurement. `focus_after.ts` moves focus after a recovery action of the
component controls. `retry_focus.ts` moves focus after each other Try again,
first to the status that replaces the button and then to the content, under
the [recovery focus rule](../../../../docs/protocol/mokly-viewer.md#package-and-props).
Frame sessions carry their source choices and stage refs, so
geometry never reads package selectors. Each shell root
owns one `frame_registry.tsx` instance, so frame
path-keyed identity, readiness, validated usage revisions and disposal cannot cross an
independent embedded viewer. `frame_mount_hook.ts` mounts each frame, and
mounts it again when the reader presses Try again after a failed load, and
`frame_session_usage.ts` adopts changed usage. A mount reports ready in the same
step as its last usage-revision check, so usage adopted during mounting always
reaches the frame. Public-handle inspection and
`workspace_inspection.tsx` coordinate through the registry's inspection owner.
`instance_box_model.ts` owns the selected instance's box model reader and its
rounded sizes, and an adapter without `boxModel` gives the smallest rectangle
of the instance's boxes. It coalesces geometry requests and rejects stale session results.
Workspace masks and labels, public inspection, and host markers acquire the registry's single geometry
scheduler; a usage revision supersedes any unresolved measurement before fresh
evidence is read. The navigation's resize drag state stays on the
owning shell root so independent embedded viewers cannot alter the host page or
each other. Embedded roots also own their flex containment, and
`@mokly/ui/embedded-layout` measures host stage overlays against the current
preview, keeping sibling viewers, navigation and the right panel outside an
overlay's bounds. Browser transport
remains behind `useViewerCapabilities`. The
[rendering boundary of the component controls contract](../../../../docs/protocol/mokly-component-controls.md#rendering-boundary)
defines route loading, revision fencing, and the absence of the render
capability in the static build.

Before the first render, the browser entry reads the stored disclosure map
and the navigation width through
[`../standalone/preferences.ts`](../standalone/preferences.ts), so the shell
paints them at once. Disclosure helpers treat native `<details>` groups and the
button-controlled entry-variant lists as the same persisted state. Folder
identities follow the [folder contract](../../../../docs/protocol/mokly-folders.md#order),
and persisted values follow the
[disclosure persistence contract](../../../../docs/protocol/mokly-disclosure-persistence.md).

Appearance follows the same order: the browser entry resolves the theme and
scheme through [`../standalone/startup.ts`](../standalone/startup.ts) before
it creates the React root. It writes the stub document's theme at that point.
[`../standalone/use_appearance.ts`](../standalone/use_appearance.ts) holds the
appearance in React state for loading, failed, version, and ready states.
The ready shell passes the theme, scheme, and change callback to its layout
and controlled Appearance selector. It selects the same scheme in the store.
A light-only catalogue keeps Light previews under a Dark interface.
Embedded roots receive `theme` from their host and keep independent preview
controls. Their entry graph imports no standalone appearance code.
Standalone route installation passes scheme pins to the React appearance
owner through a callback. It never changes preview selection separately.
A reader's choice wins over later pins through navigation and browser history.
Each preview wrapper records its actual
file's scheme for iframe media queries, native controls, preview surfaces and
comparison backgrounds, including globally light-only catalogues.
`scheme_fallback.ts` decides when a document keeps its light file under Dark
in a catalogue with a dark axis. A current document's reading frame then
names the fallback in its label, in both layouts. A removed document's
section head, and in the compact layout its entry bar, read `Showing previous
version — Light only` instead while the preview scheme is Dark. The
stylesheets of `@mokly/ui/canvas-frame`, `@mokly/ui/preview-frame`,
`@mokly/ui/comparison-pane`, and `@mokly/ui/canvas-comparison` set every
preview surface background and iframe color scheme from the wrapper's scheme.
Transparent content therefore keeps its selected Light or Dark base in screen,
page, component, historical and comparison frames, independently of interface
appearance.
React's frame adapters exclusively own source changes. Appearance state
supplies the effective scheme, avoiding iframe history entries
during manual or automatic appearance changes. The frame-source hook keeps the
first source and updates sources only for frames without an active adapter; it
must not race adapter-owned history-replacing navigation.
Display-only selection updates preserve manually collapsed filtered groups;
only changed search, tag or Changes filters reveal their matching groups.

`changes_tab.tsx` draws the Changes tab of any entry with
`@mokly/ui/changes-panel`, under the
[Changes tab contract](../../../../docs/protocol/mokly-changes-controls.md#changes-tab):
the change stepper of `@mokly/ui/change-stepper`, whose place, count and
neighbours `change_position.ts` finds among the entries that the Changes
filter lists, in its order, and whose steps open those entries at their
catalogue rows' addresses, which name no viewport and no scheme; the
`changesStart` slot of `changes_start.tsx`, whose container the shell
registers as a host slot; the Compared rail of `@mokly/ui/compared-rail`,
with the index's base and the one version of a removed entry, or of an added
entry that offers no comparison (`comparedOutcome`): the workspace panel
passes the gate that offers every compare mode, so a variant set's added row
names both versions while another of its shown rows compares;
then the modes and the details that the caller gives. An entry that the
Changes filter does not list has no stepper. `compare_modes.tsx` gives a
screen's or a component's modes to the tab: the offer rule of the
[screen controls](../../../../docs/protocol/mokly-changes-controls.md#screen-controls),
every mode while the workspace offers its compare, as a variant set does
while a shown row compares, Current alone for a shown status of Added, and
none otherwise or for a removed screen; the tiles of
`@mokly/ui/compare-modes` with a chip for each shown frame whose row
compares, or for each view of a removed component or variant; Scroll
together of `use_scroll_together.ts`; and Refresh while the comparison holds
a row's generation. While Changes is the selected tab,
`compare_mode_keys.ts` binds the keys 1 to 5 to the offered modes. The tab's
comparison details list the outcome line of each compared frame, such as
`Desktop · Light · Screen changed` (`comparison_outcome.ts`). The canvas
shows the chosen mode only while Changes is the selected tab: the workspace
gates the compare with `shown`, and the inspection, the edit previews and
the frames' selection read that a compare shows only then, so Inspect sees
the current frames. `comparison_mode.tsx` gives host markers and the host's
pick the same shown mode, Current while Inspect is selected.
`comparison_canvas.tsx` draws the compare on the canvas, under the
[pane layout](../../../../docs/protocol/mokly-comparison-panes.md#layout):
`workspace_comparison.ts` gives it the frames that compare, from the canvas's
shown frames (`comparison_rows.ts`; a removed component or variant, which has
no live frames, gets the frames of its own views and its own section), and
the frame that Side by side compares, which starts on the first compared
frame, the picked frame in the compact layout, and which `setComparedFrame`
of `comparison_compared_frame.ts` chooses. `comparison_canvas_state.ts`
decides what the canvas holds: `Loading comparison…` until every demanded row
has a generation, the failure when every drawn row failed, whose Try again
requests every row again, or the line of an entry without a comparison, which
`@mokly/ui/canvas-comparison` draws on a canvas in place of the section while
the section's live frames stay mounted out of sight, or the compared frames.
Through the context of `comparison_canvas_context.ts`, `canvas_stage.tsx`
then takes the section of `comparison_cells.tsx`: in Overlay, Difference and
Swipe each compared frame takes its live frame's cell, and in Side by side
the section holds the compared frame's Before and Current frames. A frame
that misses one of its two versions makes the compare fall back to Side by
side. A failed row's frames have no versions: each draws the row's failure in
its cell, whose Try again requests that row again. The
container's `shown` input, true by default, gates the compare: while it is
false the canvas shows its live frames, while the mode, the loaded comparison
and its presentations stay. `comparison_canvas_parts.ts` keeps one scroll
controller for each compared frame, Swipe's divider position, which every
frame shares and which opens in the middle, and the measured sizes of
component frames (`comparison_frame_size.ts`): the larger width and height of
both versions, measured once with `measureContentBox` when both documents
load. `use_comparison.ts` requests, renews and fences the selected
comparison. Current entries use Serve's selected endpoint. Removed component
parents and variants use the current index's advertised generation in every
host, which separates historical entries from current entries at the same path.
`comparison_presentation.ts` owns its request identity and
axes. The comparison holds one generation for each compared row, by the row's
entry id (`generations`), and `comparison_selection.ts` gives each compared
frame its row's view of the frame's viewport and scheme, with the snapshot
addresses of its row's generation. `use_comparison_documents.ts` presents
every selected pane document through the shared snapshot loader of its row's
immutable generation, and reports each row ready only when all of its
documents are accepted. Its framework-free core, `comparison_documents.ts`,
keeps one generation's presentations across mode, frame, viewport and scheme
switches and discards them when Refresh, Try again, a new generation,
Current or navigation replaces the comparison; a failure shows the existing
failure copy with Try again. The compared frames share one last-scrolled
version (`comparison_scroll_owner.ts`). `comparison_stack.tsx` draws one
frame of Overlay, Difference or Swipe, whose page viewport holds the Before
layer and the Current layer, at half opacity, blended, or to the right of
Swipe's divider of `@mokly/ui/swipe-divider`; `comparison_side.tsx` draws one
version of Side by side in its own canvas frame, with its Before or Current
tag, or the design copy of a missing version that the
[pane layout](../../../../docs/protocol/mokly-comparison-panes.md#layout)
names. `comparison_viewport.tsx` attaches the page viewport and its range
spacer, which `@mokly/ui/comparison-pane` draws inside the canvas frame's
document at the frame's nominal size, to the scroll controller through refs,
and `comparison_frame.tsx` reuses `preview_frame.tsx`'s `SnapshotFrame` and the
read-only guard for each version, marked `data-mokly-comparison-frame` with
`scrolling="no"`. Each version forwards its canvas input with
`listenForCanvasInput` to the `useCanvasFrameInput` hook of
`canvas_frame_input.tsx`, so ⌘ or Ctrl with the wheel, a pinch and the zoom
keys reach the canvas from a pane, Escape and the search keys reach the shell,
and its keyboard focus draws its frame's focus glow.

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
a removed screen share, on the canvas at every width, under the
[removed previews contract](../../../../docs/protocol/mokly-removed-previews.md#behavior):
the host marked by `data-mokly-preview`, which `@mokly/ui/canvas-previous-version`
draws, around `canvas_removed.tsx`. While the request runs, or after it
failed, the canvas of `@mokly/ui/canvas-state` holds that state in place of
the section, with no zoom pill. Once the preview is ready, the section's head
holds the title, the path, the Removed status and the quiet label "Showing
previous version" (`canvas_removed_section.tsx`). `canvas_removed_screen.tsx`
draws a removed screen's section from `canvas_removed_frames.ts`: one canvas
frame for each historical view, Desktop beside Mobile and the Light row above
the Dark row, with a viewport choice that keeps one column, as for a current
screen. A viewport without a historical view holds the note of
`@mokly/ui/canvas-missing-view` in its frames' places; its second sentence
shows only while no frame of the other viewport shows. In the compact layout
the section shows the frame of the selection's viewport and scheme alone,
which the entry bar's picker picks as for a current screen, and the entry
bar names the previous version beside the Removed status while it shows:
`RemovedPreviewStage` reports it through `onShown` to the
`usePreviousVersionLabel` of `canvas_removed_section.tsx`. The
dock's Fit hides while the canvas holds a state, because only a section
registers the canvas. A removed page or
document opens as one reading frame, named by its source file. A previous
version's frame has no frame adapter, so `SnapshotFrame` forwards the canvas
input of each document that it presents with `listenForCanvasInput`, with
the frame element, and the `useCanvasFrameInput` hook of
`canvas_frame_input.tsx`, which the live frames share, routes it through the
`CanvasControlContext` of `canvas_stage.tsx`: a zoom key runs its command,
a zoom wheel or a pinch, a two-finger pinch included, zooms the canvas about
its point in the frame, and the document's keyboard focus draws the frame's
focus glow. Escape and the search keys go to the shell, as from a live frame.
The React
request lifecycle reads preview
data directly from props. It advertises a packaged address only when the accepted
public catalogue publishes one, so a delivery without that descriptor stays
quiet. A removed screen uses the route's held, fenced detail. Its stage waits
for that detail and shows the unavailable state with Retry if the detail fails
or is rejected. Retry requests the route detail again. Page and document
previews fetch their own metadata. The stage also waits for its historical
documents and offers Retry if that request fails. The request fencing lives in
`use_removed_preview.ts`; it creates the
shared snapshot-presentation loader for the loaded generation with only the
`before` side enabled, then fetches and validates the historical document of
every shown frame before reporting ready. Only a screen's viewport choice and
a document's preview scheme choose other frames, so only they request
documents again. Each loaded frame receives
only a script-disabled, viewer-origin `srcdoc`, with
`data-mokly-preview-source` naming the immutable snapshot address. The
viewer-owned guard cancels links and forms, scrolls same-document anchors
without native navigation, and restores the accepted presentation after any
later frame navigation. The copy and Retry contract comes from
[`previews/copy.ts`](../previews/copy.ts).
`views.tsx` uses it for removed pages and `workspace.tsx` for removed screens;
neither offers a compare mode there, while a removed component or variant
offers every mode.
`@mokly/ui/empty-state` draws the loading and unavailable states, and the
note of a missing view keeps the `mbk-preview-note` and `mbk-preview-switch`
classes of `@mokly/ui/preview-state`, which the design catalogue's
stylesheets read.
See [previews](../previews/README.md) for the client side.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).

Markdown documents use the reading frame of `canvas_reading.tsx` in both
layouts, with scheme-specific routes; in the compact layout the frame takes
the canvas's width.
`previews.tsx` and `use_removed_preview.ts` select the historical document's
scheme through the same page preview lifecycle. Documents have no viewport or
usage axis; logical links in a document reach the parent shell through the
frame adapter.
