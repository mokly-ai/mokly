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
automation, and Playwright browser coverage are implemented. The irreversible
first publication and downstream consumer cutover remain external steps.
Canonical outer navigation from links inside fragment frames, request-visible
fragment transport, ownership-aware preview adaptation, and active-tree
disclosure are implemented. Their delivery history is recorded in the completed
[in-frame catalogue link navigation plan](../../plans/in-frame-catalogue-link-navigation.md).

Browse is a first-party host of [`@mokly/viewer`](./mokly-viewer.md). The
public catalogue (Milestone 3), optional frame transport (Milestone 4) and
package extraction (Milestone 5) are implemented as recorded in the
[viewer library plan](../../plans/mokly-viewer-library.md). The existing
local shell, CSS, interactions and script-disabled sandbox remain unchanged.

## Component Workspaces

Registered components extend this runtime with saved variant pages, nested usage,
actual screen instances, and local prop editing. The [explorer contract](./mokly-component-explorer.md)
owns the icon inspector, bounded panes, desktop resizing, mobile bottom sheet,
viewport/appearance controls, and authenticated highlighting. The [controls contract](./mokly-component-controls.md)
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
- missing stylesheets and declared dependencies;
- invalid `colorSchemes` config, per-screen `colorSchemes` declarations, or
  color-scheme subsets unsupported by the catalogue config;
- missing `lightStylesheets` / `darkStylesheets` files, or a stylesheet path one
  rule would link twice into the same fragment;
- invalid or colliding `darkFragments` manifest routes;
- stale, missing, or proven-orphan generated output in committed mode;
- malformed Review-ignore markers or material keys;
- protected-source or source-inventory violations.

The failure report groups problems by class and tells the author whether to run
`mokly build` or edit source/config. `check` never rewrites output.

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

This same shell is rendered by the viewer package's
TSX/SSR entry and enhanced by its existing vanilla runtime. Serve/export mount
it without slots using the [same-origin adapter](./mokly-frame-adapter.md).
React remains absent from exported browsers. Slots, theming and host-triggered
pick mode are public embedding APIs; they add no local UI. First-party Serve
retains its private control/evidence integration outside the public catalogue.

The package owns a neutral, responsive Mokly shell: a top bar with brand,
search with its tag picker; a catalogue navigation
column with a `Collapse all` control, an All/Changes filter, nested disclosure
groups with folder/screen/page/flow icons and indent guides; an accessible
desktop split separator that resizes the navigation within the design bounds
and remembers the served-origin preference; linked breadcrumbs with an id
chip; viewport and color-scheme switching; realistic phone and browser device
chrome; a per-frame expand-to-overlay toggle; and a collapsible details
inspector. Current and comparison views share the same navigation and saved
width. Serve loads its package-owned browser graph from one explicit allowlist,
and export and repository preview copy that same inventory. Alongside the ES
module graph, `navigation-resize.js` and `appearance-startup.js` are
self-contained classic IIFEs under `/__mokly/client/`, with no React, Node or
CLI dependency. The appearance asset is present before any shell markup
references it and is inert unless a standalone document opts in; comparison
snapshots carry no shell scripts. The mobile drawer does not expose the
separator.
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
Source modules, declared dependencies, and configured shared-impact globs alone
must not mark unchanged screens or propagate unchanged screens into use cases.
Entry comparison uses an explicit projection of route-affecting fields plus
the ordered ancestor collection ids and titles derived from `childIds`.
Serialized `navPath` labels are compatibility output and cannot independently
mark a screen or use case as changed. Reparenting an entry or renaming one of
its ancestor collections marks the routed entry as changed.
The projection excludes source locations and dependency declarations; changes
to those implementation details remain secondary comparison evidence. Fragment
comparison applies the same paired ignore rules and material keys as screen
comparisons. Ignored-only edits stay out of Changes. Referenced CSS, images,
fonts, and transitive local resources remain eligible even when HTML bytes are
unchanged. Removed
screens remain accessible using their baseline metadata, with an explicit
missing-current state. Both watched and non-watched serving compute the filter.
When a screen is directly affected, every use case that embeds that screen's
fragments is affected too and remains visible in the changed-only filter.

A screen embeds its generated mobile and desktop fragments inside package-owned
device frames. A use case renders ordered steps that reference those same
fragments and link back to their standalone screens. A page embeds its complete generated document without viewport or comparison
controls. All ancestors are structural collection crumbs and stay text. The details inspector may show description, rationale,
source and fragment paths including dark renders, the schemes a screen renders
in, the tags the entry declares, related docs, dependencies, use cases, and
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
effective.

Every standalone document carries one Appearance selector in the top bar —
Auto, Light and Dark — at both widths and on every route, including the
catalogue home, an unavailable route and a light-only catalogue. It sets the
interface and the previews together: the document mark, screen and use-case
step frames, component samples, comparison frames and fallback captions all
follow it, and the choice survives in-shell navigation, Back, Forward,
evidence refresh and watched reload recovery. Precedence, storage and the
classic startup asset are specified in
[mokly-viewer-appearance.md](./mokly-viewer-appearance.md). An embedded root
has no Appearance selector; its host owns the interface appearance, and the
root keeps a Dark preview toggle for the preview scheme when the catalogue has
dark fragments. Only the inside of a device screen follows the preview scheme.
A screen with no dark render keeps its light fragments and names the fallback
in its frame label (`MOBILE — LIGHT ONLY`), while a use-case step, which has no
label, simply stays light; a catalogue with no dark fragments at all captions
nothing, because nothing fell back.

Browse is server rendered first and progressively enhanced. Direct URLs,
refresh, missing routes, and JavaScript-disabled use remain functional. For an
eligible unmodified same-origin Browse link, the client replaces only the
route-owned main view and updates URL, title, active row, focus, and history.
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
choice still survives in-shell navigation when writes fail. The browser-frame
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
navigation for a marked catalogue link inside a Browse frame when enhancement
is available.
There is no native outer-navigation fallback; failed or disabled enhancement
keeps the portable link frame-owned and the sandbox prevents direct or nested
content from replacing the shell. Served Browse applies a request-visible
logical fragment during server rendering. The static deployed preview applies
it progressively to each current and light/dark swap source so scheme changes
retain the anchor.

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
and on-demand comparison with shared impact and ignored-region classification.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Changes and comparisons](./mokly-changes.md)
- [CI and npm release](./npm-release.md)
