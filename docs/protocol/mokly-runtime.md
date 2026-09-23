# Mokly Build And Browse Runtime

[Whole-document pages](./mokly-pages.md) share the same explicit collection
hierarchy as screens and flows. The [migration contract](./mokly-page-migration.md)
defines the required consumer upgrade.

## Source Of Truth

Consumer-authored registry modules and imported render helpers are the source of
truth. In the default [derived mode](./mokly-derived-baselines.md), generated
fragments, page HTML, and the manifest are local artifacts and the baseline is
rebuilt from the merge-base commit. Explicit committed mode instead keeps those
artifacts in Git so they can be reviewed without executing historical code.
Browsing and comparisons consume the same rendered documents and definitions;
neither may introduce a second screen renderer or catalogue. This repository's
basic example uses the default derived mode: only its authored inputs,
including public CSS, are tracked. Build generates its local HTML and manifest.

## Delivery Status

This document defines the release-ready runtime contract. The Build, Check,
watch, server, and comparison engines, the responsive package-owned catalogue,
on-demand screen diffs, packed-package consumers, CI/release
automation, and Playwright browser coverage are implemented. Both npm packages
have completed their [initial registration](./npm-bootstrap.md); subsequent
versions follow the [coordinated release contract](./npm-release.md).
Canonical outer navigation from links inside fragment frames, request-visible
fragment transport, ownership-aware preview adaptation, and active-tree
disclosure are implemented. Their delivery history is recorded in the completed
[in-frame catalogue link navigation plan](../../plans/in-frame-catalogue-link-navigation.md).

Browse is a first-party host of [`@mokly/viewer`](./mokly-viewer.md). The
public catalogue (Milestone 3), optional frame transport (Milestone 4) and
package extraction (Milestone 5) are implemented as recorded in the
[viewer library plan](../../plans/mokly-viewer-library.md). The
[React Browse shell plan](../../plans/react-browse-shell.md) delivers one React
tree shared by standalone Serve, static export and embedded hosts. Standalone
documents render the complete shell on the server and hydrate it in the browser;
embedded hosts mount the same components with host-owned selection and slots.
Consumer frames and comparisons remain static HTML in script-disabled sandboxes.
Selecting a removed page or screen captures and renders its pinned previous
version in that shared tree through the lifecycle implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).
The single Changes rule, component stylesheet validation and removal of the
Dependencies display are planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
implemented in Milestones 3, 4 and 5 respectively; this text describes the
target while current code still accepts old declarations.

## Component Workspaces

Registered components extend this runtime with saved variant pages, nested usage,
actual screen instances, and local prop editing. The [explorer contract](./mokly-component-explorer.md)
owns the icon inspector, bounded panes, desktop resizing, mobile bottom sheet,
viewport/theme controls, and authenticated highlighting. The [controls contract](./mokly-component-controls.md)
owns the private same-origin endpoint, bounded worker, immutable memory previews,
last-good watched generation, and no-output/no-reload editing boundary. Exported
workspaces retain saved variants and inspection with read-only props.

[Component attribution](./mokly-component-changes.md) separates directly changed
entries from affected consumers. Watch, Browse and export share that calculation;
a component implementation edit cannot add its otherwise unchanged screens to
Changes. Screen-owned prop and slot changes still count as screen changes.

## Build

`mokly build` performs this transaction:

1. Load and validate config.
2. Discover and bundle all entry, renderer, transformer, and imported helper modules.
3. Validate registry metadata, routes, relationships, and output collisions.
4. Render screen fragments and registered whole-document pages in deterministic order.
5. Resolve id links and validate document links and anchors.
6. Build the version 5 manifest and resolved source inventory.
7. Stage every generated file before changing the last-good output.
8. Atomically replace generated files and remove proven generated orphans.

An error leaves the last-good generated tree unchanged. Build output and
diagnostics use repo-relative paths and deterministic ordering.

## Check

`mokly check` computes expected output without mutating files. In
derived mode it fails when Git tracks generated routes, the manifest or cache
contents, and does not require generated output to exist or match on disk. It
fails for:

- invalid config or registry metadata;
- duplicate ids/routes or route/fragment/page collisions;
- missing collection children, duplicate child references, children claimed by
  multiple collections, collection cycles, missing use-case screens, or
  reciprocal memberships;
- unresolved `mock:` links, raw document links, local HTML/CSS resources, or
  anchors;
- missing configured or component-declared public stylesheets;
- invalid `colorSchemes` config, per-screen `colorSchemes` declarations, or
  color-scheme subsets unsupported by the catalogue config;
- missing `lightStylesheets` / `darkStylesheets` files, or a stylesheet path one
  rule would link twice into the same fragment;
- invalid or colliding `darkFragments` manifest routes;
- stale, missing, proven-orphan, or unclaimed generated output in committed
  mode; unclaimed means Mokly-headered HTML whose owner is outside every
  configured entry-glob prefix and the current source inventory;
- malformed Review-ignore markers or material keys;
- protected-source or source-inventory violations.

The committed failure report groups missing, stale, orphan, and unclaimed paths.
Run `mokly build` for the first three. Build does not alter unclaimed files;
delete them or restore their source under a configured entry glob. Consumer HTML
without a valid Mokly ownership header is authored public content and is not an
unclaimed-file error. `check` never rewrites output.

## Catalogue And Routes

`mokly export --out <directory>` uses the same build, catalogue, shell, and
comparison engines to create a complete static site. Its separate output
transaction, Git prerequisites, path ownership, and input-consistency checks
are defined by [Consumer static export](./mokly-export.md). Exact file routes,
real directory-index id aliases, static delivery metadata, and lazy immutable
comparisons are defined by [Static export delivery](./mokly-export-delivery.md).
No server or watcher is started for export; served behavior below is unchanged.

Serve validates its distinct live catalogue index and independently resolves both
source graphs before binding. Full-manifest consumers still require validated v5
output and a current source inventory. These scans never render pages or rewrite
output. The [on-demand contract](./mokly-on-demand.md) defines completeness,
worker isolation and generation-local caches. Browse exposes:

- `/` for the catalogue home;
- `/view/<route>` for screens, use cases, and registered whole-document pages;
- `/id/<id>` as a canonical redirect for routed registry entries;
- `/static/<path>` for generated fragments, document pages, and consumer assets,
  always delivered with `Cache-Control: no-store` because watched rebuilds
  replace bytes at stable URLs;
- `/__mokly/diffs/review.json` for explicitly requested comparisons, with
  redirects to immutable generations and snapshot files beneath the same prefix;
- package-owned client and update endpoints under `/__mokly/`.

Serve also exposes [`/__mokly/catalogue.json`](./mokly-catalogue.md)
as the public read model, refreshed atomically on watched content/evidence
updates. It keeps the private manifest and on-demand readiness boundary intact.

Browse does not run Git classification on its HTTP event loop or request path.
The watched child receives the accepted config, live index and retained bundle
before readiness, without rendered HTML or a full manifest-file read. It validates
metadata and source-inventory freshness, then binds with local controls enabled.
Requested views render in a bounded worker. Complete output, catalogue-wide usage
and Changes follow in background work; versioned updates install only current
generation evidence. Non-watched Serve has the same readiness boundary and computes
background evidence once, without later file/ref observation. A derived baseline
is prepared in the parent between output adoption and classification, so a
replaced worker never orphans a rebuild; the parent cancels and restarts it when
an observed ref change moves the merge base.

All ordinary routes support GET and HEAD. HEAD returns the same status and
headers without a body, including `/id` not-found and fragment-validation
errors. A HEAD request to the update endpoint completes without opening or
registering an event stream.

Collections are navigation folders, not destinations. Unknown ids and routes
return a not-found main view while keeping catalogue navigation available.
Static path handling rejects traversal and does not expose repository files
outside configured public roots. The shared relative-path decoder rejects
malformed encoding, absolute and empty paths, dot segments, and forward or
backslash separators introduced by decoding one original URL segment before
any filesystem resolution.

Browse caches the validated collection forest from manifest `childIds`.
Structured roots, nested navigation, and breadcrumbs all consume that one
model; serialized `navPath` labels from current or historical manifests never
override it. An unclaimed screen, page, or use case renders directly at the
catalogue root with no invented group or breadcrumb. Registered pages use the
same collection forest. Historical legacy records are comparison inputs only;
source and route directories never create current navigation groups.

## Browse Shell

The shell is the viewer package's React component tree, rendered on the server
by its SSR entry and hydrated in the browser by Serve, export and React hosts
alike, as defined by the [viewer contract](./mokly-viewer.md#shell-tree-and-state).
Serve/export mount it without slots using the
[same-origin adapter](./mokly-frame-adapter.md) and load the standalone
hydration entry, which bundles React. Slots, theming and host-triggered pick
mode are public embedding APIs; they add no local UI. First-party Serve
supplies its private control/evidence capabilities to the tree through a typed
context outside the public catalogue; export supplies none.

The package owns a neutral, responsive Mokly shell: a top bar with brand,
search with its tag picker; a catalogue navigation
column with a `Collapse all` control, an All/Changes filter, nested disclosure
groups with folder/screen/page/flow icons and indent guides; an accessible
desktop split separator that resizes the navigation within the design bounds
and remembers the served-origin preference; linked breadcrumbs with an id
chip; viewport and appearance controls; realistic phone and browser device
chrome; a per-frame expand-to-overlay toggle; and a collapsible details
inspector. Current and comparison views share the same navigation and saved
width. The package build records every browser output in a generated manifest;
Serve validates exact manifest/directory equality and export copies that same
inventory. `navigation-resize.js` and `appearance-startup.js` are classic
pre-hydration bundles under `/__mokly/client/`. They capture native disclosure
and width choices and restore appearance before React hydrates; the React shell
then adopts those values and owns ongoing navigation, selection and rendering.
The appearance controller remains responsible for its stored preference and
system-theme listener. Comparison snapshots carry no shell scripts. The mobile
drawer does not expose the separator.
Consumer brand chrome does not appear in the shell. A small set of documented
CSS custom properties may tune the shell accent without replacing its
structural styles. The shell serves its packaged Inter variable font from
`/__mokly/fonts/`. The All/Changes filter lives at the top of the navigation
column, shows the changed count, and derives from Git changes between the
current workspace and the merge base shared by `HEAD` and the serve base ref.
Commits reachable only from the base ref are not branch changes. Staged,
unstaged, and untracked workspace changes remain eligible. When the repository,
base ref, or common ancestor cannot be resolved, live Browse keeps both tabs and
shows an explicit unavailable message when Changes is selected. Pending calculation
shows a spinner in the reserved count slot and, when selected, in the sidebar.
A derived-baseline rebuild precedes that calculation with its own `preparing`
state, which uses the same spinner and adds a secondary sidebar line; see the
[derived baselines contract](./mokly-derived-baselines.md).
All remains available throughout; a completed empty result shows zero. See the
[on-demand lifecycle](./mokly-on-demand.md).
Route attribution compares each current manifest entry with its base entry and
matches material fragment changes and changes to rendered local resources.
In every catalogue, source modules and unreferenced paths alone must not mark
unchanged screens or propagate unchanged screens into use cases. They are not
comparison evidence either.
Entry comparison uses an explicit projection of route-affecting fields plus
the ordered ancestor collection ids and titles derived from `childIds`.
Serialized `navPath` labels are compatibility output and cannot independently
mark a screen or use case as changed. Reparenting an entry or renaming one of
its ancestor collections marks the routed entry as changed.
The projection excludes source locations and removed path declarations; changes
to those implementation details supply no comparison evidence. Fragment
comparison applies the same paired ignore rules and material keys as screen
comparisons. Ignored-only edits stay out of Changes. Referenced CSS, images,
fonts, and transitive local resources remain eligible even when HTML bytes are
unchanged. Removed
screens remain accessible using their baseline metadata and open their
[previous version](./mokly-removed-previews.md).
Both watched and non-watched serving compute the filter.
When a screen is directly affected, every use case that embeds that screen's
fragments is affected too and remains visible in the changed-only filter.

A screen embeds its generated mobile and desktop fragments inside package-owned
device frames. A use case renders ordered steps that reference those same
fragments and link back to their standalone screens. A page embeds its complete generated document without viewport or comparison
controls. All ancestors are structural collection crumbs and stay text. The details inspector may show description, rationale,
source and fragment paths including dark renders, the schemes a screen renders
in, the tags the entry declares, related docs, use cases, and
comparison context.
Default Browse fragments and document pages are sandboxed without script permission
so they cannot alter the same-origin Browse shell. Package-owned same-origin
inspection permits parent-owned outer navigation after explicit user
activation. Browse does not grant either
top-navigation sandbox token, so direct and nested consumer contexts retain the
active restriction that prevents them from replacing the shell. The
served/preview adapter authenticates markers only for current-manifest
screen fragments and generated document pages whose ownership header names that
entry's manifest `sourcePath`. The versioned header stores that identity as
canonical base64, keeping arbitrary repository filename bytes out of the HTML
comment grammar. The adapter shares the strict build/cleanup decoder and
accepts either LF or CRLF after that exact header. During migration it also
recognizes the former raw-path header only when its source is valid comment
content. Unowned HTML loses
package-reserved metadata in the adapted copy; a trusted route with
missing/mismatched ownership, invalid markers, or a marker/portable-href
mismatch fails closed. One strict typed
target parser supplies inert metadata only to trusted parent enhancement. A
trusted document that carries an activatable marker and `<base href>` also
fails closed, including if post-build tampering introduced the base URL;
consumer-authored `href`, `<base target>`, `target`, and `formtarget` values
otherwise remain portable and sandbox-confined. Consumer scripts, forms,
popups, downloads, and top navigation remain forbidden in this default mode. The
explicit cross-origin host exception is confined to the frame-adapter contract.
Review panes retain their stricter sandbox and byte-unmodified documents.

The top-level disclosures use `section:pages` and `section:components` as their
rendered and persisted identities. A collection projected into a section uses
`collection:<section>:<id>`, so the two appearances of a mixed collection retain
independent state. Labels remain presentation only. Stored pre-section
`collection:<id>` keys apply to either projection during migration; obsolete
`legacy:` and label-path keys are ignored while valid disclosure keys remain
effective. The [screen variants contract](./mokly-screen-variants.md) adds
`variants:<section>:<parent id>` for the variant list a screen row discloses,
persisted, restored, and collapsed beside the collection keys. That list is a
container rather than a `<details>`, because the row beside it is a link and
cannot also be a summary; its `hidden` state and its button's `aria-expanded`
carry the same disclosure the collection keys carry, and the button's
accessible name follows the state. When search or the Changes filter hides a
parent row, it hides the entire leaf container, so no disclosure button remains
visible or focusable without its row; the container reappears with the row. A
parent row whose list holds a changed route carries `data-changed-variants`,
the aggregate mark that keeps the group visible under the Changes filter
without claiming the parent itself changed.
The stylesheet draws that attribute and `data-changed` as the same trailing
dot, and reveals the row's visually hidden change wording to assistive
technology, so a background evidence refresh moves the mark by toggling the
attributes alone. A Removed row is never marked. Activating a parent row that
carries only the aggregate mark while the Changes filter is selected navigates
to the first changed variant row its list still shows.

Per-view change evidence drives the status beside the title and the comparison
band, so both describe the shown view rather than the route-wide result. With
one viewport and one scheme selected, `changed`, `added`, and `removed` map to
Changed, Added, and Removed; `unchanged` and `ignored-only` map to Unmodified.
While Both is selected, the shown status is Changed if any shown view is
Changed, else Added if any is Added, else Removed if any is Removed, else
Unmodified. Comparison eligibility follows the shown status under the existing
kind rule: Changed, or Removed for a component saved variant. If neither a ready
result nor screen-view evidence exists for the entry, route-level status and
eligibility remain in force. Switching viewport, scheme, or saved variant
recomputes both without a page load, and a background evidence refresh does the
same.

The workspace publishes the changed views in its serialized data. Each view
control carries a mark for changed views the reader cannot currently see: the
theme control for the other scheme and the viewport control for the other
viewport. Both shows every viewport, so its control is never marked. The 6px
accent dot has a visually hidden description named through `aria-describedby`,
keeping it distinct from the pressed state and independent of color. The
details inspector lists the same views as `Changed views`, in mobile-before-
desktop and light-before-dark order, and hides the row while nothing is named.
The marks and row point to the changed views when the shown view is Unmodified.
A light-only catalogue has no scheme control or scheme mark. For a component,
this evidence describes the selected saved variant and changes with that
selection.

Opening a changed row while the Changes filter is selected lands on the first
changed view instead of the sticky selection. Arriving from the filter is an
explicit signal rather than a guess: activating the row records one
session-scoped intent naming the destination, and the destination workspace
reads and clears that intent as it installs, landing only when the intent names
the page being installed. A URL that names `viewport` or `scheme` is an
explicit request and wins outright. Because the intent is consumed once, a
direct URL, an All-filter activation, Back, Forward, and a reload all keep the
sticky selection. A light-only catalogue clamps the requested scheme to light,
so it never lands on dark.

Every standalone document carries one Appearance selector in the top bar —
Auto, Light and Dark — at both widths and on every route, including home,
unavailable routes and light-only catalogues. It sets the interface and preview
selection together, survives React-owned navigation and follows the preference,
URL pin and system rules in the
[appearance contract](./mokly-viewer-appearance.md). The standalone head band
and component workspace expose no second scheme control. An embedded root has
no Appearance selector: its host owns interface `theme`, while top-bar,
head-band and workspace controls continue to select preview color scheme when
dark fragments exist. A screen without a dark render keeps its light fragments
and names the fallback in its frame label (`MOBILE — LIGHT ONLY`); a use-case
step, which has no label, simply stays light. A wholly light-only catalogue
shows no fallback labels because no dark axis exists.

Browse is server rendered first and hydrated. The server output is the
complete shell with real anchors, so direct URLs, refresh, missing routes, and
JavaScript-disabled use remain functional before and without hydration. For an
eligible unmodified same-origin Browse link, the hydrated shell renders the
destination from the catalogue read model instead of loading a document, and
updates URL, title, active row, focus, and history; it never fetches shell HTML
to swap into the page.
Logical links activated inside a consumer frame navigate that same outer route
model rather than replacing only the iframe document. The shell opens the active
row's ancestor collections, conditionally clears a search or Changes filter
that would hide it, and scrolls it into view. The complete target,
portable-link, safe-degradation,
sandbox, fragment, and active-tree behavior is defined by the
[catalogue navigation contract](./mokly-navigation.md).
Search, disclosure, filters, and catalogue scroll remain mounted. A search
value splits into whitespace-separated terms: every `tag:<tag>` term
(case-insensitive) keeps only rows whose entry declares that tag, and the
remaining words rejoin into one phrase that must appear in a row's authored ID,
title, or route. A row survives only when every tag term and that one phrase
match, so tags compose with free text and with the All/Changes filter, and a term
nothing matches hides those rows and the groups they empty. Selecting a tag chip enters
`tag:<tag>` in the search field, replacing any tag term already entered;
selecting the chip whose tag is entered clears that term. Chips are buttons that
report the entered tag through `aria-pressed`, and they keep that mark through
in-shell navigation and watched reloads. The search field's tag control opens
and closes a panel of every tag the catalogue declares: opening moves focus to
the entered tag's chip, else to the first, and the chip row carries one tab stop
that ArrowLeft and ArrowRight rove and wrap at both ends, Home and End send to
its ends, and Enter or Space activates. Choosing a chip there also closes the
panel and returns focus to the control. An open panel answers Escape before an
expanded frame does, closing the panel and returning focus to the control
without changing the query, while a click outside closes it and leaves focus
where the click put it, returning focus to the control only when the closing
panel still holds it. The panel is ephemeral: nothing reopens it after a
watched reload or a restored session. Each user edit to search or the
All/Changes filter opens groups to reveal its current matches.
Route changes and watched-reload restoration during active filtering
preserve groups the user subsequently collapsed, except for the destination's
ancestor path. Clearing all filtering restores the earlier disclosure state,
but a destination path opened by navigation stays open. Navigation groups and
the details inspector retain explicit disclosure choices across in-shell navigation,
durable navigation, and browser reloads for that origin. Unavailable or
malformed browser storage leaves the server-rendered default intact; the latest
choice still survives in-shell navigation when writes fail. A native disclosure
toggled before hydration completes is captured by the pre-hydration script and
wins over the stored preference for that load. The browser-frame
expand toggle overlays one frame at a time and collapses on Escape, on an
outside click, and on route navigation. Clicking a screen or use-case ID chip
labelled `#<id>` copies the unprefixed ID without navigating. Clicking a frame
address copies it to the clipboard.

The shell scrolls inside its stage, flow, and embed regions rather than the
document. Back and Forward restore the matching route and that history entry's
latest per-region scroll positions. Scroll persistence is limited to one
leading update per animation frame, and route-change focus never overrides the
restored positions. Overlapping requests are latest-wins. Download,
external, hash-only, metadata-only, and unmarked links retain their existing
frame-owned behavior. Trusted parent code owns primary and new-context
navigation for a marked catalogue link inside a Browse frame when the shell
is hydrated.
There is no native outer-navigation fallback; an unhydrated or failed shell
keeps the portable link frame-owned and the sandbox prevents direct or nested
content from replacing the shell. Served Browse applies a request-visible
logical fragment during server rendering. In the static deployed preview the
hydrated shell renders it into each current and light/dark swap source so
scheme changes retain the anchor.

The shell meets keyboard, focus, reduced-motion, contrast, semantics, and status
announcement requirements. Mobile and desktop shell variants are specified by
the design mockups in the basic example's `design/` catalogue, and the
[shell design contract](./mokly-shell-design.md) records the approved CSS
custom properties, tokens, and responsive behavior the implementation
preserves. Intentional presentation differences between the mockups and the
shipped shell are recorded beside the design catalogue in the example notes.

## Watched Development

The [watch lifecycle contract](./mokly-watch.md) defines reload recovery,
transactional config changes, stable ports, invalidation, and shutdown.

## Screen Comparisons

The [Changes contract](./mokly-changes.md) defines on-demand controls,
Git comparison, snapshot isolation, ignored regions, and the metadata format.
There is no Review section or standalone comparison CLI command.

## Required Coverage

Unit, integration, packed-consumer, and browser checks cover build/check,
route safety, navigation, history/focus, color schemes, watch recovery, shutdown,
and on-demand comparison with rendered-resource and ignored-region classification.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Changes and comparisons](./mokly-changes.md)
- [CI and npm release](./npm-release.md)
