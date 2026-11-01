# Shared Browse shell

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
mark only when `materialChangedEntries` lists it. Details add a `Moved from`
row after Source, and the comparison details name the previous path as the
earlier side. A pure move is in Changes without changing, so workspace
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
links, the variant bar, removed tree rows, workspace keys, breadcrumbs,
details and the public workspace all use it.
[`branch_point_guard.test.ts`](../../../../tests/branch_point_guard.test.ts)
fails when a shell or viewer module outside the lookup reads `previousPaths`,
follows a `variantOf`, or case-folds a path.

These React components are the Browse shell tree: catalogue, stages,
navigation and inspector. The tree renders only in the browser:
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
entry remains represented once. A removed page or document is a flat row
that only Changes shows; All and search hide it. Current section nodes use the
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
drawer at narrow widths, and asks `nav_scroll.ts` to focus the folder row.
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
route result. `details_rows.tsx` resolves the inspector's
metadata rows, including links between a screen and its variants, the
`Changed views` row, and Related docs links, and `@mokly/ui/metadata-row`
draws them. A related doc links to its
document when it is a public `mock:<path>` reference or, in Serve and the
static build, the source path of a current document; a removed entry keeps
plain labels.

`view_marks.ts` is the shared vocabulary for per-view change evidence: the two
axes that name a view, their reader labels, and the rule
that decides whether the theme and viewport controls carry a mark.
`workspace_views.ts` resolves the requested axes to the views actually shown,
including Dark-to-Light fallback, and carries the matching status, comparison
eligibility, and evidence provenance as one decision. `workspace_controls.tsx`
applies the rule to that effective scheme while retaining the requested scheme
as the control state, so navigation and controlled-host updates cannot leave
stale indicators, and it passes the marks, their ids, and their wording to
`@mokly/ui/view-controls`.
`public_workspace_views.ts` derives the changed views themselves from
the published catalogue's ready per-view comparisons. Workspace data keys
those lists by component variant path or screen path, and
`workspace_views_data.ts` reads the list of the shown selection, so every
reader selects the evidence that belongs to the preview;
`@mokly/ui/change-mark` draws the dot and clips its wording, and
`@mokly/ui/view-controls` mutes the dot on a disabled control.
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
`workspace_context.tsx` owns one routed workspace and its resolved views for
the top-bar Appearance indicator and workspace. `workspace.tsx` consumes that
shared resolution on every viewport, scheme, component variant, or evidence
change and passes the effective scheme to controls and comparison presentation.
`comparison_request.ts` establishes a comparison's generation root: a
pinned catalogue's advertised root without a request, or the root that
Serve's selection endpoint redirects to, which a HEAD request renews. A failed
request shows the comparison failure with Try again; Current remains
available.
Every failed comparison uses the details sentence "The comparison is
unavailable.". The shell never shows server or browser error text there.
`use_comparison.ts` is the single owner of comparison mode: component sibling
navigation keeps that owner mounted, and the workspace reads its mode directly
so Props and highlighting remain read-only until Current is selected.
`views.tsx` keys the workspace with `workspaceKey`, the parent the lookup
resolves, so a removed variant of a moved or case-renamed parent opens in its
siblings' workspace and keeps their mode. The mode owner also includes the
index revision, so a publication returns an active comparison to Current.
`comparison_intent.ts` applies a route's comparison intent once. The store
counts route installations and keeps the installed route's intent; the
routed workspace settles it when `comparisonEligibilityKnown` first reports
final eligibility, and opens Side by side only for an eligible view. A
publication keeps the count, so it cannot reopen the comparison, and the mode
owner never reads the address.

Every element of the shell is a `@mokly/ui` component under
`packages/ui/src`: props in, callbacks out, no store. Each module here that
renders is a container. It reads the store, the contexts, and the frames, and
it renders package components with props and callbacks, as `appearance.tsx`
reads the identifier and workspace contexts and renders
`@mokly/ui/appearance-selector`. `top_bar.tsx`, `nav.tsx`, and `head.tsx` render
the top bar, the catalogue navigation, and the screen header the same way,
and `head.tsx`'s viewport and scheme switches render
`@mokly/ui/segmented-control`. `tags.tsx` renders the search field's tag
picker with `@mokly/ui/tag-picker` and each tag chip of the details with
`@mokly/ui/tag-chip`. `workspace_controls.tsx` renders
`@mokly/ui/view-controls`, and `views.tsx` and `workspace.tsx` render the
status beside a title with `@mokly/ui/change-status`. `inspector.tsx` renders
`@mokly/ui/inspector`, and `details.tsx` renders `@mokly/ui/details-panel`.
The inspector's panels render `@mokly/ui/prop-field`,
`@mokly/ui/controls-panel`, `@mokly/ui/props-panel`, `@mokly/ui/usage-list`,
`@mokly/ui/instance-tree`, and `@mokly/ui/comparison-evidence`, from records
that their containers build, and the preview shows the status of an edit's
render with `@mokly/ui/edit-status`. The controls' wording of
`component_controls_copy.ts` reaches them as props. The preview's containers
render `@mokly/ui/stage`, `@mokly/ui/preview-frame`, `@mokly/ui/device-frame`,
`@mokly/ui/flow-step`, `@mokly/ui/previous-version`,
`@mokly/ui/preview-state`, `@mokly/ui/scheme-fallback`,
`@mokly/ui/comparison-stage`, `@mokly/ui/comparison-pane`,
`@mokly/ui/empty-state`, and `@mokly/ui/variant-bar`. Each `<iframe>` element
is `PreviewIframe` of `@mokly/ui/preview-frame`: a container passes its `ref`,
its `src` or `srcDoc`, its `key`, and its data attributes, and it keeps the
mount hooks, the sources, the read-only guard, and the scroll controllers.
`frames.tsx` holds which browser frame is expanded in the store and copies its
address, while the package shows "URL copied". `views.tsx` renders the main
region of `@mokly/ui/shell-layout`, `workspace.tsx` lays out the workspace
with `@mokly/ui/workspace-layout`, and `embedded_viewer.tsx` lays out an
embedded root and its host slots with `@mokly/ui/embedded-layout`, which
places each slot's content and never reads it. The standalone shell's root
and the loading, failure, and version states of both roots render
`@mokly/ui/shell-layout`, and the highlight labels of the workspace and of a
host's inspection render `@mokly/ui/highlight-label`. Both inspection layers
draw one `@mokly/ui/highlight-mask` over each highlighted frame from the same
boundary snapshot as their labels, for same-origin and cross-origin frames.
The mask clips to the visible frame and stays above an expanded frame.
A local ESLint rule
rejects every intrinsic JSX element in `packages/viewer/src`, so a container
renders only package components, fragments, providers, and portals. Text
that the shell derives from catalogue data stays here and reaches the
components as props, such as the sentences of `entry_wording.ts` and the
change-mark ids and wording of `view_marks.ts`. The design library and the
artboards under `examples/basic/specs/design` render the same package
sources, so a change to a package component also changes its design mockups.

The shell holds no style rule. `@mokly/ui/styles.css` holds every rule of the
shell, in the cascade order that `packages/ui/src/styles.css` lists: the
theme, the shared controls, the components, then the layout and its
responsive rules. The viewer build writes the standalone `shell.css` and the
embedded `styles.css` from that stylesheet and the `@font-face` rule of the
shell font.

The theme gives the stub's document class the Auto appearance before the
bundle runs. The standalone shell sets its appearance, scheme, and state marks
on its own root, as an embedded root does, and never on `body`. The appearance
controller also writes the appearance on `<html>`, so the stub page around the
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
An inspector tag then returns focus to the toggle in its own shell. Picker
chips keep the focus return of `@mokly/ui/tag-picker`.

`store.tsx` and the focused `store_*` modules own the shared route,
selection, disclosure, drawer, details and scroll state. `store_browser.ts`
owns standalone history, and `store_host.ts` owns host selection commits.
`store_routes.ts` installs each route's display for both roots.
`store_interactions.ts` binds both roots to clicks and Escape. It dismisses
the picker and expanded frame on an outside click, including a click outside
an embedded root. It returns picker focus only when the panel held focus.
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
detail. A use case also requests each step screen's detail. The module loads
each detail under the fences of the
[shell delivery contract](../../../../docs/protocol/mokly-shell-delivery.md#fetch-and-fences),
and loads a publication refresh; `data_refresh.ts` runs one such refresh at a
time for the controller and keeps the route whose refresh failed.
`data_commit.ts` adopts a new index and its details as one snapshot and
rebinds the route and the disclosures to it;
`data_store.ts` binds the controller to the store, and `data_context.tsx`
exposes the routed delivery and the live render capability. The stage renders
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

A use case's
stage, in `public_stage.tsx`, shows each step with `@mokly/ui/flow-step` and
its desktop view in a browser frame, or, while `narrow_layout.ts` reports a
window at most 760px wide, its mobile view in a phone frame, under the
[device chrome contract](../../../../docs/protocol/mokly-shell-device-chrome.md#device-chrome).
`layout_breakpoint.ts` holds that contract's layout breakpoint as one media
query, narrower than 900px, which every shell and viewer rule and script
reads, so the catalogue drawer, the inspector sheet and the embedded rail
switch at the same width. It also holds the contract's device breakpoint, at
most 760px wide, which `narrow_layout.ts` watches. The `@mokly/ui`
stylesheets cannot import either query, so they repeat them, and the viewer's
[styles test](../../tests/styles.test.ts) holds them to both.

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
Details omits derived route
and generated-path rows because the address bar and path chip already identify
the entry.

Snapshot selection is route-owned state as well as public selection state. One
validated query/parser/resolver carries it through the first render,
controlled hosts and history. Headings, crumbs, Details and previous-preview lookup consume
the resolved removed record and route.

`workspace_data.ts` describes shell data. Its `entry` is always the exact
routed screen, component parent, or component variant; component routes retain
their parent schema separately for controls. A screen or component parent reads
its lists from its own detail. A current component variant reads Used by and
Affected from its parent's detail, while its own detail supplies its other
workspace facts. Every value is projected only from validated index and detail
records: every catalogue of a delivery carries its published records.
`comparison_views.tsx` renders
React-owned frame chrome around the snapshots from validated comparison
metadata.

`workspace_evidence_data.ts` merges an entry's own reasons, which
`publicWorkspace` reads from the routed entry detail's `reasons`, the selected
screen's or variant's projected and live view evidence, and a loaded
comparison by path and rule key, so Current and a loaded comparison show the
same facts once. `workspace_evidence_merge.ts` clears held reasons that a newer
publication no longer carries. `workspace_stylesheet_evidence.ts` turns that evidence into
one item per changed file, with the contract's outcome sentences in order: own
component rules, page selectors, unresolved rules, or else the full matched
styles. `@mokly/ui/comparison-evidence` draws each file once with its
sentences and selector lists nested in its item, like the approved card.
`entry_wording.ts` declares each kind's nouns once and builds the kind's
evidence sentences, status lines and pane labels from them. A component's
sentences name the shown variant, while its file list and its own rules name
the component.
`evidence_details.ts` builds the files and exclusions records, so
`workspace_evidence.tsx` and a page's Details pass the same facts to
`@mokly/ui/comparison-evidence`, which draws the shared heading and block.
`workspace_evidence.tsx` words each reason and decides which facts show, and
the package follows the designs' order: the reason
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
Details keep the rest of the evidence without that sentence. `workspace_data.ts`
passes the shell's known name to `publicWorkspace`, so a workspace keeps the
sentence while its entry detail loads. The workspace projects the selected
views' `resourceEvidence` from the held entry detail through
`public_workspace_views.ts` and `../review/view_evidence.ts`. A
whole-document page has no workspace: `page_evidence_data.ts` reads its status
from the index record and its evidence record from the page's entry detail,
and `page_evidence.tsx` passes them with the page wording to
`@mokly/ui/comparison-evidence` in the page's `details.tsx` panel. `views.tsx`
shows that status beside the page title.

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
collapsed choices; route navigation owns active-route reveal. The
`nav_rows.ts` and `nav_leaf_rows.ts` missing-key defaults remain defensive
for rendering without a store; mounted shells supply every current key. A
removed-entry route whose snapshot record leaves a refreshed index shows the
missing state.

`workspace.tsx` coordinates the React workspace without owning transport or
frame internals. `component_controls.tsx` owns cancellable temporary prop edits,
and `component_control_fields.tsx` derives each control's field, which
`@mokly/ui/prop-field` lays out as a row, its name in
a label column and then its value, help, and error, as the
[controls design](../../../../docs/protocol/mokly-component-controls-design.md)
draws them. Numeric fields use the effective bounds and step of the index's `controls`.
`control_numbers.ts` aligns those bounds with the HTML input's zero-based step.
The focused `workspace_*` containers turn evidence, usage, instances and
supplied props into the records of the package's panels. `@mokly/ui/inspector`
owns the tab keys and returns focus from Close to the tab pressed last.
`inspector.tsx` closes the inspector the same way on Escape anywhere in its
shell root. `inspector_resize.ts` owns the divider and the mobile sheet,
because they read the workspace panes and the shell root. Each shell root
owns one `frame_registry.tsx` instance, so frame
path-keyed identity, readiness, validated usage revisions and disposal cannot cross an
independent embedded viewer. `frame_mount_hook.ts` mounts each frame, and
`frame_session_usage.ts` adopts changed usage. A mount reports ready in the same
step as its last usage-revision check, so usage adopted during mounting always
reaches the frame. Public-handle inspection and
`workspace_inspection.tsx` coordinate through the registry's inspection owner.
Workspace masks and labels, public inspection, and host markers acquire the registry's single geometry
scheduler; a usage revision supersedes any unresolved measurement before fresh
evidence is read. Navigation and inspector resize drag state stays on the
owning shell root so independent embedded viewers cannot alter the host page or
each other. Embedded roots also own their flex containment, and
`@mokly/ui/embedded-layout` measures host stage overlays against the current
preview, keeping sibling viewers, navigation and the inspector outside an
overlay's bounds. Browser transport
remains behind `useViewerCapabilities`. The
[rendering boundary of the component controls contract](../../../../docs/protocol/mokly-component-controls.md#rendering-boundary)
defines route loading, revision fencing, and the absence of the render
capability in the static build.

Before the first render, the browser entry reads the stored disclosure map,
the Details choice and the navigation width through
[`../standalone/preferences.ts`](../standalone/preferences.ts), so the shell
paints them at once. Disclosure helpers treat native `<details>` groups and the
button-controlled entry-variant lists as the same persisted state. Folder
identities follow the [folder contract](../../../../docs/protocol/mokly-folders.md#order),
and persisted values follow the
[disclosure persistence contract](../../../../docs/protocol/mokly-disclosure-persistence.md).

Appearance follows the same order: the browser entry installs the appearance
controller of [`../standalone/startup.ts`](../standalone/startup.ts) before the
first render, so it resolves Auto/Light/Dark from the stored choice or the
system before the shell paints.
[`appearance_bridge.ts`](../standalone/appearance_bridge.ts) adopts that theme
and the controller's effective scheme into the live shell, marks the shell root
with both, and independently asks the store for matching preview files. A light-only catalogue can therefore keep
Light previews under a Dark interface. Embedded roots skip the bridge and
receive `theme` from their host while retaining independent preview controls.
Standalone route installation sends scheme pins to that controller; it never
changes preview selection separately. A reader's choice wins over later pins
through navigation and browser history. Each preview wrapper records its actual
file's scheme for iframe media queries, native controls, device colors and
comparison backgrounds, including globally light-only catalogues.
`scheme_fallback.ts` decides when a document keeps its light file under Dark
in a catalogue with a dark axis. A current document then gets a band above its
pane, and a removed one a suffix on `Showing previous version`; both carry the
`Light only` note of `@mokly/ui/scheme-fallback`, which the stylesheet shows
only under Dark. The stylesheets of `@mokly/ui/preview-frame`,
`@mokly/ui/device-frame`, and `@mokly/ui/comparison-pane` set every preview
surface background and iframe color scheme from the wrapper's scheme.
Transparent content therefore keeps its selected Light or Dark base in screen,
page, component, historical and comparison frames, independently of interface
appearance.
React's frame adapters exclusively own source changes; the appearance
controller only reports the effective scheme, avoiding iframe history entries
during manual or automatic appearance changes. The frame-source hook keeps the
first source and updates sources only for frames without an active adapter; it
must not race adapter-owned history-replacing navigation.
Display-only selection updates preserve manually collapsed filtered groups;
only changed search, tag or Changes filters reveal their matching groups.

`diffs.tsx` owns the comparison band and stage, which
`@mokly/ui/comparison-stage` draws; `@mokly/ui/comparison-toolbar`
renders the band's mode group, the Scroll together switch (a native checkbox
with `role="switch"`, shown in every diff mode including loading and failure)
and Refresh, from props and callbacks alone. `use_comparison.ts` requests, renews and fences the selected
comparison. Current entries use Serve's selected endpoint. Removed component
parents and variants use the current index's advertised generation in every
host, which separates historical entries from current entries at the same path.
`comparison_presentation.ts` owns its request identity and
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
for views missing a side, whose message is the design copy that the
[pane layout](../../../../docs/protocol/mokly-comparison-panes.md#layout)
names. `comparison_chrome.tsx` picks the browser, phone or
bordered component frame, `comparison_viewport.tsx` attaches the shared
viewport, its sticky device-sized box and range spacer, which
`@mokly/ui/comparison-pane` draws, to the scroll controller through refs, and
`comparison_frame.tsx` reuses `preview_frame.tsx`'s `SnapshotFrame` and the
read-only guard for each version, marked `data-mokly-comparison-frame` with
`scrolling="no"`.

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
device chrome around captured screen views, which `@mokly/ui/previous-version`
and `@mokly/ui/device-frame` draw. It advertises a packaged address only when the accepted
public catalogue publishes one, so a delivery without that descriptor stays
quiet. A removed screen uses the route's held, fenced detail. Its stage waits
for that detail and shows the unavailable state with Retry if the detail fails
or is rejected. Retry requests the route detail again. Page and document
previews fetch their own metadata. The stage also waits for its historical
documents and offers Retry if that request fails. The request fencing lives in
`use_removed_preview.ts`; it creates the
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
`@mokly/ui/preview-state` draws the loading, unavailable, and missing states,
including the `mbk-preview-note` and `mbk-preview-switch` classes the design
catalogue's stage stylesheet owns. The Both-only rule of `@mokly/ui/stage`
reads the normalized `data-viewport` value on the live stage.
See [previews](../previews/README.md) for the client side.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).

Markdown documents use `DocumentStageFrame` with scheme-specific routes.
`previews.tsx` and `use_removed_preview.ts` select the historical document's
scheme through the same page preview lifecycle. Documents have no viewport or
usage axis; logical links in a document reach the parent shell through the
frame adapter.
