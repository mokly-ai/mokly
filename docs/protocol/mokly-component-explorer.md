# Component Pages And Screen Inspection

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Catalogue And Component Pages

Components are a distinct entry kind in a dedicated collapsible Components
section, with a component icon and the same All/Changes filter, count, search,
tags, breadcrumbs, path chip, and responsive navigation. Screens, whole-document
pages, documents, and use cases stay in the sibling Specs section. Both sections
are views of the one path-derived [catalogue tree](./mokly-catalogue.md#tree)
filtered by kind, so a folder holding both kinds appears in each with its own
children, and folder rows only expand or collapse under the
[folder row rules](./mokly-folders.md#rows-and-clicks). No separate explorer
application or invented Components folder exists; a component library is
conventionally a root with `path: "components"` under the
[configuration contract](./mokly-configuration.md).

A component page contains its title, description, a variant bar, preview
canvas, grouped view controls, eligible comparison controls, and an icon
inspector. Every component is a render over props under the
[entry props contract](./mokly-entry-props.md): the parent entry has its own
views, rendered from its own props, and each saved variant is an entry at the
parent's path plus its slug. The parent page shows the parent's own view on
the stage, and the variant bar lists the parent first, then each variant in
authored order, and marks the shown entry; a variant page shows that variant's
view. The heading uses the parent component's title on the parent page and on
every variant page. The path chip, status beside the heading, Details, and URL
describe the shown entry. Screen variants have no variant bar and keep their
own title as the heading. The canvas uses the consumer renderer and gives a
small component suitable space without implying it is a whole phone screen.
Mobile and desktop still select distinct viewport contexts; controls must not
fake scaling or modify consumer props to fit. Long or full-width components
stay inspectable by scrolling.

One icon toolbar beside the title contains a Mobile/Desktop/Both dropdown.
Screen views add the Highlight components toggle there. Standalone uses one
top-bar Appearance selector; embedded hosts keep a separate preview toggle.
Both renders both real viewport contexts. The shell and title stay fixed. On
desktop, the preview and vertically resizable inspector are sibling panes
whose contents scroll, with the navigation divider's centred short-line grip.
Runtime resizing supports pointer input across the divider and keyboard input,
clamps both pane sizes, and restores usable bounds after closing and reopening
or viewport changes. On mobile, the inspector is a rounded, non-modal bottom
sheet over the full-size preview, with an iOS-style grabber, compact and
expanded snap heights, safe-area spacing, pan gestures, and an accessible size
toggle. The icon strip and close action stay outside scrolling content.
Closing leaves the icon strip with no selected icon; reopening keeps edits. The
mockups use a native switch for size changes; gesture handling belongs to the
runtime.

Each component variant is an entry, nav, search and Changes row, and `mock:`
target under the [variant contract](./mokly-variants.md). The variant bar
navigates by path in authored order, so URLs and Back/Forward need no query
parameter.

Comparison modes apply to the shown entry and view axes. Sibling-mode
retention, read-only Props, disabled highlighting, and response fencing follow
[variant navigation](./mokly-variant-navigation.md). A removed component
variant stays eligible with a missing current side; Added stays in Current.

Only expose comparison modes when the shown status is Changed or when a
component variant entry's shown status is Removed. A known selection shows
Added, Changed, Removed, or Unmodified beside its title from the selected
viewport and scheme; Both follows the aggregation rule of the
[Changes screen controls](./mokly-changes-controls.md#screen-controls). A
removed variant is its own Removed entry and does not mark its surviving
parent Removed; the parent's status describes the parent only. Added and
Unmodified show only their current preview. Missing per-view evidence keeps
entry-level status and eligibility rather than implying Unmodified. Affected
consumers can stay eligible without entering Changes; temporary control edits
never establish comparison eligibility. Do not eagerly generate screenshots to
decide whether the mode row is available.

A logical link can target a component parent or any of its variant entries by
path under the [navigation contract](./mokly-navigation.md). A link to the
parent resolves to the parent's own view in the effective viewport and theme;
a link to a variant entry resolves to that entry's own view. Variant bar and
Used by links are shell-owned `/view/<path>/` URLs; do not overload the
logical fragment grammar with component prop JSON or variant suffixes.
Affected-consumer destinations use the
[branch-point lookup](./mokly-branch-point-lookup.md#reference-sides) and carry
explicit comparison eligibility. A removed screen link opens its Removed
state, showing its [previous version](./mokly-removed-previews.md) without a
comparison query; an eligible removed component variant may request its
comparison with the missing current side. The destination validates its view
before activating a comparison query.

The shared inspector has Details, Props/Controls, and Usage icons. Composed
components also have Nested components, listing their rendered registered
children and excluding themselves; leaves omit that tab. Screens keep the
Components tab, including empty and unavailable states. Clicking an icon opens
its panel or switches the open panel; clicking the active icon or Close
collapses it. With no panel open, no icon is selected. Details contains
source, docs, tags and any rendered-resource comparison evidence. Comparison
details use validated reasons, paired prop values, and related changed
components; they never infer visual explanations from pixels or add a banner
above the canvas. Props contains the supplied values, and Usage contains Used
by screens and components. These lists come from the `workspace` of the
[entry detail](./mokly-shell-delivery.md#entry-detail): `usedBy`, `affected`,
`relatedComponents`, and `inputChanges`. A changed component also exposes
Affected screens. Removed consumers link to their Removed state; their
comparison evidence stays in Details. Lists distinguish direct and transitive
use and show actual instance and view counts without counting reused flow
frames as additional screen uses. Empty lists have explicit empty states. The
[inspector design contract](./mokly-component-inspector-design.md) defines the
shared layout and native mockup behaviour; runtime keyboard focus and Escape
handling belong to the shell.

The index carries no usage, so no cross-route list is derived from it. Until
the entry detail arrives, the Usage panel shows `Loading usage…` with no
counts, list headings, rows, or empty state. A detail that fails to load or is
rejected leaves the entry unavailable with a retry control under the shell
delivery contract; retry preserves the inspector disclosure and local edits.
Only a ready detail may show the zero-consumer state.

## Components In The Screen Inspector

Every screen uses the same icon inspector. Its Components panel lists actual
instances for the active viewport and scheme, grouped by component, with
nested relationships and readable instance labels, from the view's `usage` in
the entry detail. Selecting an instance opens Props with supplied data, slot
references, and links to its component page. Unrendered conditional branches
do not appear; null-rendering instances are listed without a visible region.
An empty ready usage set says no registered components are used in this view.
Unavailable usage says inspection is unavailable.

Pending usage is neither empty nor unavailable. The Components panel and the
Highlight control use `Waiting for the component preview.` until ready usage
is adopted into the mounted frame. Usage adopted during mounting reaches the
frame before it is ready, so Highlight cannot use older usage. A detail that
fails to load keeps inspection unavailable and offers recovery through the
entry's retry control, never the empty-view copy.

Repeated instances stay individually selectable. Nested component groups start
collapsed and can be expanded to inspect inner instances. Selecting an instance
reveals its props and allows opening the canonical component page without
losing the screen's navigation history. Raw source paths and identifiers stay
secondary metadata; visible labels use the component title and instance label.

Selecting a component-page Used by link opens the owning screen in Current,
sets its recorded viewport and theme, and opens its selected instance in Props.
Multiple matching occurrences stay selectable. Route query values reference
validated instance keys of the [instance contract](./mokly-instances.md) and
cannot introduce arbitrary DOM selectors or file paths.

## Highlight Components

The screen toolbar has a keyboard-operable Highlight components toggle with an
accessible pressed state. It starts off. In Current, enabling it dims the
surrounding screen while registered component regions keep their original
appearance. Outlines and labels identify visible regions; selecting a region
selects the corresponding instance and opens Props if needed. Selecting a
Components entry highlights and scrolls its instance into view.

Initially highlight outermost visible component boundaries. Selecting or
expanding a nested entry focuses that instance so a large shared container does
not make every nested control indistinguishable. At a nested depth, nonselected
content is dimmed again. Sibling or repeated instances stay independently
selectable through outlines and the accessible Components list.

Implement highlighting as shell-owned presentation over validated live DOM
ranges, with dimming-mask cutouts for the selected regions. Do not set opacity
on a consumer ancestor and try to restore opacity on its descendants. Do not
clone component DOM, change its position, insert layout wrappers, or alter its
computed styles. Component pixels, layout, and original opacity stay intact.
Cross-origin overlays reset the package host's presentation with important
styles and isolate and reset their SVG in a shadow root, so consumer CSS
cannot paint over selected regions. Both measurers share
containing-block-aware clipping for fixed elements, transformed ancestors and
inner scrollers.

Bounds come from the active composed document, support multi-root and text
ranges, and follow scroll, nested scroll containers, frame resize and
expansion, fonts and images loading, and viewport and theme swaps. Clip to the
visible frame and its clipping ancestors; do not highlight unrelated content
covered by occluding elements. Zero-area and hidden instances stay inspectable
in the inspector without an invented rectangle. Unsupported boundaries report
unavailable inspection explicitly.

While the toggle is on, selecting outlined regions inspects them rather than
following their product links. Normal frame navigation is restored when it is
off. Escape exits inspection and returns focus to the toggle. Selection is
exposed through the Components list so neither hover nor pointer precision is
required. Labels must not rely on colour alone.

Turning off highlighting removes all masks and listeners and returns the
unmodified screen. Route changes and a full page load turn it off and clear
stale instance selection. A viewport or theme change rebinds usage to the new
document; preserve a selection only if its identity still exists. Entering a
comparison turns highlighting off; its toggle is unavailable in comparison
modes, whose snapshots stay unmodified. Removed screens also disable it because
there is no current preview to inspect. Component-page nested inspection can
reuse this same mechanism.

## Frame And Delivery Boundary

By default, package-owned shell code inspects its immediate, same-origin,
authenticated frame. Component metadata extends the Browse ownership
validation. Unvalidated documents, nested frames, and comparison snapshots
receive no inspection privileges. Consumer scripts, forms, popups, and top
navigation stay disabled; do not loosen frame sandbox policy for this feature.

`build` writes the same entry details and the package-owned inspector code,
so saved variants, inspector panels, backlinks, and highlighting work from the
static output without Serve. Composed documents keep normal content and
portable links; they do not require the interactive inspector. Temporary local
controls are governed separately by the
[controls contract](./mokly-component-controls.md).

The frame boundary lets the [viewer](./mokly-viewer.md) access boundaries,
highlighting, scrolling and frame events through the
[frame adapter](./mokly-frame-adapter.md). `sameOriginAdapter` encapsulates
same-origin document access without changing authentication, visuals or
sandbox. An explicit cross-origin host instead uses the nonce- and
origin-checked inspector in published copies on a separate origin with
`allow-same-origin allow-scripts`. That host exception enables document
scripts; local frames and comparison snapshots keep their restrictions.
Host-only pick mode reuses Highlight components and adds no local control.
Instance lookup uses the [scoped identity contract](./mokly-instances.md), not
source locations, DOM text or guessed geometry. Public imperative highlighting
keeps entry, viewport, scheme, and flow-step scope through masks, labels and
emitted events. This differs from the workspace's intentional multi-view
highlighting of one selected key. Frame replacement ends host picking and
clears stale inspection under the viewer lifecycle contract.

## Mockups And Verification

The owning design catalogue lives under `examples/basic/specs/design`; UI
changes update it first and check it through Serve. Do not introduce an
unrelated Expo app or a second mockup generator. It provides mobile and
desktop screen components for the component page and variants, changed
component and Affected screens, screen inspector usage, highlight selection,
loading Usage, and empty and unavailable states. The
[controls designs](./mokly-component-controls-design.md) belong to the
inspector; local Serve implements those controls.

Each owning screen-spec page has at most five screens. Split additional states
into linked child pages, with a canonical screen on nonterminal pages. Reuse
existing shell and frame components and the shared inspector, and link new
screens from the catalogue and related screen and component pages. Flows only
compose those existing screens and link back to their owners. Keep annotations
outside rendered screen areas.

Browser tests exercise the served and the built shell with actual usage
records, both viewport and theme modes, nested, repeated and multi-root
content, scrolling, resizing, missing metadata, selection and navigation,
keyboard access, and cleanup.
