# Component Pages And Screen Inspection

Status: Inspect with its Frames filter, the canvas selection and compare on every shown frame are not built yet. [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds them.

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

A component page shows the component on the
[canvas](./mokly-shell-canvas-stage.md#section) and in the
[right panel](./mokly-component-inspector-design.md#right-panel). Every
component is a render over props under the
[entry props contract](./mokly-entry-props.md): the parent entry has its own
views, rendered from its own props, and each saved variant is an entry at the
parent's path plus its slug. A component opens as its variant set, and
Inspect's Variants section lists its saved variants. A saved variant's page
opens its parent's variant set with that variant's Light frame selected. The
heading uses the parent component's title on the parent page and on every
variant page. The path chip, status beside the heading, Details, and URL
describe the shown entry. A screen variant keeps its own title as the heading.
A component's frame shows its desktop view, sized to its content, so a small
component takes the space that it needs without implying that it is a whole
phone screen. Controls never modify consumer props to fit a frame. Long or
full-width components stay inspectable through pan and zoom.

The [Frames filter](./mokly-shell-canvas-stage.md#frames-filter) in Inspect
chooses the shown frames. The
[preview scheme rules](./mokly-shell-device-chrome.md#color-scheme) give the
standalone Appearance selector and the Dark preview control of an embedded
host. In the [compact layout](./mokly-shell-device-chrome.md#compact-layout),
the right panel opens as the panel sheet: a rounded, non-modal sheet with
compact and expanded snap heights, safe-area spacing, pan gestures, and an
accessible size toggle. Its tab strip and close control stay outside the
scrolling body. Closing the sheet keeps edits, and reopening shows them. The
mockups draw each sheet at the height that its state gives; gesture handling
belongs to the runtime.

Each component variant is an entry, nav, search and Changes row, and `mock:`
target under the [variant contract](./mokly-variants.md). A variant's page is
addressed by its own path, so URLs and Back/Forward need no query parameter.

In a compare mode, each shown frame of a compared row compares its own view, and
a row that does not compare, such as an Added one, keeps its current frames.
Sibling-mode retention, read-only Props, disabled highlighting, and response
fencing follow [variant navigation](./mokly-variant-navigation.md). A removed
component variant stays eligible with a missing current side.

Only offer the compare modes other than Current while a shown row compares: when
its shown status is Changed, or when a component variant entry's shown status is
Removed. A known selection shows Added, Changed, Removed, or Unmodified beside
its title from the shown views; several shown views follow the aggregation rule
of the [Changes screen controls](./mokly-changes-controls.md#screen-controls). A
removed variant is its own Removed entry and does not mark its surviving parent
Removed; the parent's status describes the parent only. Added and Unmodified
show only their current preview. Missing per-view evidence keeps entry-level
status and eligibility rather than implying Unmodified. Affected consumers can
stay eligible without entering Changes; temporary control edits never establish
comparison eligibility. Do not eagerly generate screenshots to decide whether
the compare modes are available.

A logical link can target a component parent or any of its variant entries by
path under the [navigation contract](./mokly-navigation.md). A link to the
parent resolves to the parent's own view in the effective viewport and theme;
a link to a variant entry resolves to that entry's own view. Variant and
Used by links are shell-owned `/view/<path>/` URLs; do not overload the
logical fragment grammar with component prop JSON or variant suffixes.
Affected-consumer destinations use the
[branch-point lookup](./mokly-branch-point-lookup.md#reference-sides) and carry
explicit comparison eligibility. An Added consumer link opens Current without
a comparison query because its view has no base side. A removed screen link opens its Removed
state, showing its [previous version](./mokly-removed-previews.md) without a
comparison query; an eligible removed component variant may request its
comparison with the missing current side. The destination validates its view
before activating a comparison query.

Inspect holds the sections of the
[inspector design](./mokly-component-inspector-design.md#inspect). A composed
component's Nested components section lists its rendered registered children
and excludes the component itself. Comparison evidence, such as
rendered-resource evidence, follows the
[Changes and evidence](./mokly-component-inspector-design.md#changes-and-evidence)
rule. Comparison details use validated reasons, paired prop values, and
related changed components; they never infer visual explanations from pixels
or add a banner above the canvas. Usage contains Used by screens and
components. These lists come from the `workspace` of the
[entry detail](./mokly-shell-delivery.md#entry-detail): `usedBy`, `affected`,
`relatedComponents`, and `inputChanges`. A changed component also exposes
Affected screens. A current component variant shows its parent's Used by and
Affected lists from the parent's detail. Its related changed components and
input changes stay specific to its own views. A removed variant shows its own
lists. Removed consumers link to their Removed state, which keeps their
comparison evidence. Lists distinguish direct and transitive use and show
actual instance and view counts without counting reused flow frames as
additional screen uses. Empty lists have explicit empty states. The
[inspector design contract](./mokly-component-inspector-design.md) defines the
shared layout and native mockup behaviour; runtime keyboard focus and Escape
handling belong to the shell.

The index carries no usage, so no cross-route list is derived from it. Until
all route details arrive, Usage shows `Loading usage…` with no counts, list
headings, rows, or empty state. A current component variant waits for its own
detail and its parent's detail. A detail that fails to load or is rejected
leaves the entry unavailable with a retry control under the shell delivery
contract. Retry preserves the state of the inspector and local edits. Only a
ready detail with a complete workspace may show the zero-consumer state.

## Components In The Screen Inspector

Inspect's Components section lists actual instances by owner, from the view's
`usage` in the entry detail: the instances that one frame's view holds, each
with the instances nested in it under a disclosure. It lists the frame that
holds the selection, else the first shown frame. A count of the instances and
their components leads the list. Each instance reads as its component title
and its instance label. Decision: the list follows ownership rather than
grouping instances by component, because the owner tree already shows each
nesting. Selecting an instance selects it on that frame under the
[canvas selection](./mokly-viewer-selection-canvas.md#clicks-by-tab), and
Inspect's Selection section shows the data and the slot references that its
owner supplies, with a link to its component page. Decision: Selection has no
Highlight action of its own, because the canvas outlines the selected instance
and the Highlight components switch highlights every registered instance.
Unrendered conditional branches do not appear; null-rendering instances are
listed without a visible region. An empty ready usage set says no registered
components are used in this view. Unavailable usage says inspection is
unavailable.

Pending usage is neither empty nor unavailable. The Components list and the
Highlight components switch use `Waiting for the component preview.` until
ready usage is adopted into the mounted frame. Usage adopted during mounting
reaches the frame before it is ready, so Highlight cannot use older usage. A
detail that fails to load keeps inspection unavailable and offers recovery
through the entry's retry control, never the empty-view copy.

Repeated instances stay individually selectable. Nested lists start collapsed
and can be expanded to inspect inner instances. Selecting an instance
reveals its props and allows opening the canonical component page without
losing the screen's navigation history. Raw source paths and identifiers stay
secondary metadata; visible labels use the component title and instance label.

Selecting a component-page Used by link opens the owning screen in Current
with its instance selected on the frame of the link's recorded viewport and
scheme, and Inspect shows the instance in its Selection section. Multiple
matching occurrences stay selectable. Route query values reference
validated instance keys of the [instance contract](./mokly-instances.md) and
cannot introduce arbitrary DOM selectors or file paths.

## Highlight Components

The Frames filter of each screen and component page holds a keyboard-operable
Highlight components switch with an accessible checked state. It starts off. A
component page highlights the registered components that its frames render;
when they render none, the switch stays disabled and states that reason.
In Current, turning it on dims each shown frame while its registered component
regions keep their original appearance. Outlines and labels identify visible
regions; selecting a region selects the corresponding instance and shows it in
Selection. Selecting a Components entry selects its instance and scrolls it
into view.

Initially highlight outermost visible component boundaries. Selecting or
expanding a nested entry focuses that instance so a large shared container does
not make every nested control indistinguishable. At a nested depth, nonselected
content is dimmed again. Sibling or repeated instances stay independently
selectable through outlines and the accessible Components list.

Highlighting is shell-owned presentation over validated live DOM ranges: a
dimming mask with cutouts for the selected regions. It never sets opacity on a
consumer ancestor. It never clones component DOM, changes its position,
inserts layout wrappers, or alters its computed styles. Component pixels,
layout, and original opacity stay intact. The shell draws the mask above the
preview frame, also over a cross-origin frame, so consumer CSS cannot paint
over it or restyle it.

Bounds come from the active composed document, support multi-root and text
ranges, and follow scroll, nested scroll containers, frame resize, pan and
zoom, fonts and images loading, and viewport and theme swaps. Clip to the
visible frame and its clipping ancestors; do not highlight unrelated content
covered by occluding elements. Clipping follows the containing block of fixed
elements, transformed ancestors, and inner scrollers. Zero-area and hidden
instances stay inspectable in the inspector without an invented rectangle.
Unsupported boundaries report unavailable inspection explicitly.

While the switch is on, selecting outlined regions inspects them rather than
following their product links. Normal frame navigation is restored when it is
off. Escape exits inspection and returns focus to the switch. Selection is
exposed through the Components list so neither hover nor pointer precision is
required. Labels must not rely on colour alone.

Turning off highlighting removes all masks and listeners and returns the
unmodified screen. Route changes and a full page load turn it off and clear
stale instance selection. A viewport or theme change rebinds usage to the new
document; preserve a selection only if its identity still exists. Entering a
compare mode other than Current turns highlighting off; the switch is
unavailable in those modes, whose snapshots stay unmodified. Removed screens
also disable it because there is no current preview to inspect.

## Frame And Delivery Boundary

By default, package-owned shell code inspects its immediate, same-origin,
authenticated frame. Component metadata extends the Browse ownership
validation. Unvalidated documents, nested frames, and comparison snapshots
receive no inspection privileges. Consumer scripts, forms, popups, and top
navigation stay disabled; do not loosen frame sandbox policy for this feature.

`build` writes the same entry details and the package-owned inspector code,
so saved variants, the inspector, backlinks, and highlighting work from the
static output without Serve. Composed documents keep normal content and
portable links; they do not require the interactive inspector. Temporary local
controls are governed separately by the
[controls contract](./mokly-component-controls.md).

The frame boundary lets the [viewer](./mokly-viewer.md) access boundaries,
highlighting, scrolling and frame events through the
[frame adapter](./mokly-frame-adapter.md). `sameOriginAdapter` encapsulates
same-origin document access without changing authentication, visuals or
sandbox. An explicit cross-origin host instead uses the nonce- and
origin-checked frame probe in published copies on a separate origin with
`allow-same-origin allow-scripts`. That host exception enables document
scripts; local frames and comparison snapshots keep their restrictions.
Host-only pick mode reuses Highlight components and adds no local control.
Instance lookup uses the [scoped identity contract](./mokly-instances.md), not
source locations, DOM text or guessed geometry. Public imperative highlighting
keeps entry, viewport, scheme, and flow-step scope through masks, labels and
emitted events. This differs from the workspace's intentional multi-view
highlighting of one selected key. Frame replacement ends host picking and
clears stale inspection under the viewer lifecycle contract.

## Mockups

The [Canvas design inventory](./mokly-shell-canvas-inventory.md) depicts the
variant set, Inspect and the selection. The
[component design](./mokly-component-design.md) depicts these pages in mobile
and desktop artboards under `design/canvas/components`: a changed component's
comparison on its variant set, its Usage and Affected screens, a removed
variant, screen inspection while usage waits or is unavailable, and Usage that
loads or failed. The
[controls designs](./mokly-component-controls-design.md) under
`design/canvas/props` belong to the inspector. Local Serve implements those
controls. The [shell design](./mokly-shell-design.md#design-mockups) names the
states that the Canvas screens do not draw.
