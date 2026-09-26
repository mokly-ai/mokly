# Component Pages And Screen Inspection

## Delivery Status

The shared component and screen workspace is implemented in Serve and static
exports: saved variants, usage, comparison evidence, highlighting, and a resizable
icon inspector. Local Serve additionally provides editable controls. See the
[component contract](./mokly-components.md), [attribution contract](./mokly-component-changes.md),
and [component design catalogue](./mokly-component-design.md). Removed
consumers open their historical screen through the behavior implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).

## Catalogue And Component Pages

Components are a distinct entry kind in a dedicated collapsible Components
section, with a component icon and the same All/Changes filter, count, search,
tags, breadcrumbs, id chip, and responsive navigation. Screens, whole-document
pages, and use cases stay in the sibling Pages section. Section-scoped `navPath`
folders remain the hierarchy within both projections; a separate explorer application
or automatically invented Components folder is not required. The example
catalogue still provides its authored Components group.

A component page contains its title, description, a variant bar linking its
variant entries, preview canvas, grouped view controls, eligible comparison
controls, and an icon inspector.
The canvas uses the consumer renderer and gives a small component suitable
space without implying it is a whole phone screen. Mobile/desktop still select
distinct viewport contexts; controls must not fake scaling or modify consumer
props to fit. Long or full-width components remain inspectable by scrolling.

One icon toolbar beside the title groups a Mobile/Desktop/Both dropdown and a
light/dark toggle. Screen views add the Highlight components toggle there. Both
renders both real viewport contexts. The shell and title stay fixed. On desktop,
the preview and vertically resizable inspector are sibling panes whose contents
scroll, with the navigation divider's centered short-line grip. Runtime resizing
supports pointer input across the divider and keyboard input, clamps both pane
sizes, and restores usable bounds after closing/reopening or viewport changes.
On mobile, the inspector is a rounded, non-modal bottom sheet over the full-size
preview, with an iOS-style grabber, compact/expanded snap heights, safe-area
spacing, pan gestures, and an accessible size toggle. The icon strip and close
action stay outside scrolling content. Closing leaves the icon strip with no
selected icon; reopening retains edits. The mockups use a native switch for
size changes; gesture handling belongs to the runtime.

Each component variant is its own routed entry under the
[variant contract](./mokly-variants.md): a nav row beneath its parent, a search
result, a Changes row, and a `mock:` link target, like a screen variant. The
variant bar lists the parent's variant entries by title, and selecting one is
navigation to that entry at its own URL, `/view/components/<variant id>.html`,
so Back/Forward treat it like any entry; there is no `variant` query parameter.
The parent's own page shows its first variant entry in authored order.
Viewport/theme changes retain the shown entry, applying existing light-only
rules.

Current / Side by side / Overlay / Difference operate on the shown variant
entry and viewport/theme. Navigating to another variant entry while comparing
uses that entry's comparison; late responses cannot replace a newer selection.
Added/removed variants retain their recorded state, but only removed variants
need an explicit missing side: a removed component variant is an ordinary
removed entry carrying `variantOf` and remains eligible for comparison with an
explicit missing current side. Added variants stay in Current without
comparison modes because there is no baseline view. Page navigation and reload
start in Current, as screens do today. Variant navigation and comparison are
fully usable in served and published catalogues.

Only expose comparison modes when the shown status is Changed or when a
component variant entry's shown status is Removed. A known selection shows
Added, Changed, Removed, or Unmodified beside its title from the selected
viewport and scheme; Both follows the aggregation rule in the
[Changes contract](./mokly-changes.md#screen-controls). A removed variant is its
own Removed entry and does not mark its surviving parent Removed; the parent's
status describes the parent only. Added and Unmodified show only their
current preview. Missing per-view evidence retains entry-level status and
eligibility rather than implying Unmodified. Affected
consumers can remain eligible without entering Changes; temporary control edits
never establish comparison eligibility. Do not eagerly generate screenshots to
decide whether the mode row is available.

`MockLink` can target a component parent or any of its variant entries by id
using the existing logical-id contract. A generated standalone link to the
parent resolves to its first variant entry's viewport/theme view; a link to a
variant entry resolves to that entry's own view. Variant bar and Used by links
are shell-owned `/view/<route>` URLs; do not overload the existing logical
fragment grammar with component prop JSON or variant suffixes.
Affected-consumer links carry explicit comparison eligibility. A removed screen
link opens its Removed state, showing its
[previous version](./mokly-removed-previews.md) without a
comparison query; an
eligible removed component variant may request its retained baseline comparison.
The destination validates the selected view again before activating any
comparison query.

The shared inspector has Details, Props/Controls, and Usage icons. Composed
components also have Nested components, listing their rendered registered
children and excluding themselves; leaves omit that tab. Screens retain the
Components tab, including empty and unavailable states.
Clicking an icon opens its panel or switches the open panel; clicking the active
icon or Close collapses it. With no panel open, no icon is selected. Details contains
source/docs/tags/dependencies and any comparison evidence. Comparison details
use validated reasons, paired prop values, and related changed components; they
never infer visual explanations from pixels or add a banner above the canvas.
Props contains the supplied values, and Usage
contains Used by screens/components derived from current usage. A changed
component also exposes Affected screens from baseline/current evidence. Removed
consumers link to their Removed state; their comparison evidence remains in
Details. Lists distinguish direct and
transitive use and show actual instance/view counts without counting reused flow
frames as additional screen uses. Empty lists have explicit empty states. The
[inspector design contract](./mokly-component-inspector-design.md) defines the
shared layout and native mockup behavior; runtime keyboard focus and Escape
handling belong to the shell implementation.

## Components In The Screen Inspector

Every registered screen uses the same icon inspector. Its Components panel
lists actual instances for the active viewport and scheme, grouped by component,
with nested relationships and readable instance labels. Selecting an instance
opens Props with supplied data, slot references, and links to its component page.
Unrendered conditional branches do not appear; null-rendering instances are
listed without a visible region. An empty usage set says no registered components
are used in this view. Legacy/missing metadata says inspection is unavailable.

Repeated instances remain individually selectable. Nested component groups start
collapsed and can be expanded to inspect inner instances. Selecting an instance
reveals its props and allows opening the canonical component page without
losing the screen's navigation history. Raw source paths and identifiers remain
secondary metadata; visible labels use the component title and instance label.

Selecting a component-page Used by link opens the owning screen in Current,
sets its recorded viewport/theme, and opens its selected instance in Props. Multiple
matching occurrences remain selectable. Route query values reference validated
manifest identities and cannot introduce arbitrary DOM selectors or file paths.

## Highlight Components

The screen toolbar gains a keyboard-operable Highlight components toggle with
an accessible pressed state. It starts off. In Current, enabling it dims the
surrounding screen while registered component regions retain their original
appearance. Outlines and labels identify visible regions; selecting a region
selects the corresponding instance and opens Props if needed.
Selecting a Components entry highlights and scrolls its instance into view.

Initially highlight outermost visible component boundaries. Selecting or
expanding a nested entry focuses that instance so a large shared container does
not make every nested control indistinguishable. At a nested depth, nonselected
content is dimmed again. Sibling or repeated instances remain independently
selectable through outlines and the accessible Components list.

Implement highlighting as shell-owned presentation over validated live DOM
ranges, with dimming-mask cutouts for the selected regions. Do not set opacity
on a consumer ancestor and try to restore opacity on its descendants. Do not
clone component DOM, change its position, insert layout wrappers, or alter its
computed styles. Component pixels, layout, and original opacity remain intact.
Cross-origin overlays reset the package host's presentation with important
styles and isolate/reset their SVG in a shadow root, so consumer CSS cannot
paint over selected regions. Both measurers share containing-block-aware
clipping for fixed elements, transformed ancestors and inner scrollers.

Bounds come from the active generated document, support multi-root/text ranges,
and follow scroll, nested scroll containers, frame resize/expansion, fonts/images
loading, and viewport/theme swaps. Clip to the visible frame and its clipping
ancestors; do not highlight unrelated content covered by occluding elements.
Zero-area/hidden instances remain inspectable in the inspector without an invented
rectangle. Unsupported boundaries report unavailable inspection explicitly.

While the toggle is on, selecting outlined regions inspects them rather than
following their product links. Normal frame navigation is restored when it is
off. Escape exits inspection and returns focus to the toggle. Selection is
exposed through the Components list so neither hover nor pointer precision is
required. Labels must not rely on color alone.

Turning off highlighting removes all masks/listeners and returns the unmodified
screen. Route changes and reload turn it off and clear stale instance selection.
A viewport/theme change rebinds usage to the new document; preserve a selection
only if its identity still exists. Entering a comparison turns highlighting off;
its toggle is unavailable in comparison modes, whose snapshots stay unmodified.
Removed screens also disable it because there is no current preview to inspect.
Component-page nested inspection can reuse this same mechanism.

## Frame And Publishing Boundary

By default, package-owned shell code inspects its immediate, same-origin, authenticated
generated frame. Component metadata extends the existing Browse ownership
validation. Arbitrary legacy documents, nested frames, and comparison snapshots
receive no new inspection privileges. Consumer scripts, forms, popups, and top
navigation remain disabled; do not loosen frame sandbox policy for this feature.

Publishing copies the same validated usage metadata and package-owned inspector
code, so saved variants, inspector panels, backlinks, and highlighting work without a
development server. Standalone generated fragments retain normal content and
portable links; they do not require the interactive inspector. Temporary local
controls are governed separately by the [controls contract](./mokly-component-controls.md).

The implemented frame boundary lets the [viewer](./mokly-viewer.md) access boundaries,
highlighting, scrolling and frame events through [FrameAdapter](./mokly-frame-adapter.md).
`sameOriginAdapter` encapsulates today's document access without changing
authentication, visuals or sandbox. An explicit cross-origin host instead uses
the nonce/origin-checked inspector in current published copies on a separate
origin with `allow-same-origin allow-scripts`. That host exception enables
document scripts; local frames and comparison snapshots keep their existing
restrictions. Host-only pick mode reuses Highlight components and adds no local
control. Instance lookup uses the [scoped identity contract](./mokly-instances.md),
not source locations, DOM text or guessed geometry.
Public imperative highlighting keeps viewport, scheme, variant and flow-step
scope through masks, labels and emitted events. This differs from the workspace's
intentional multi-view highlighting of one selected key. Frame replacement ends
host picking and clears stale inspection under the viewer lifecycle contract.

## Mockups And Verification

Before UI implementation, extend the existing design catalogue under
`examples/basic/entries/design` and regenerate its local derived HTML. This is
Mokly's current owning mockup tree; do not introduce an unrelated Expo app
or a second mockup generator. Provide mobile and desktop screen components for
the component page/variants, changed component/Affected screens, screen inspector
usage, highlight selection, and empty/unavailable states. The [controls designs](./mokly-component-controls-design.md) are delivered
with the inspector revision; local Serve implements those controls.

Each owning screen-spec page has at most five screens. Split additional states
into linked child pages, with a canonical screen on nonterminal pages. Reuse
existing shell/frame components and the shared inspector and link new screens from the catalogue
and related screen/component pages. Flows only compose those existing screens
and link back to their owners. Keep annotations outside rendered screen areas.

Run the repository's real example build/check and relevant tests, and open every
changed generated page directly from disk for visual verification. Browser
tests must also exercise the real served and published shell with actual usage
records, both viewport/theme modes, nested/repeated/multi-root content, scrolling,
resizing, missing metadata, selection/navigation, keyboard access, and cleanup.
