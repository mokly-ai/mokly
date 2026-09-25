# Component Workspace Design

## Delivery Status

Milestones 4c, 4f, and 4g of the [component explorer plan](../../plans/component-explorer.md)
revise the existing component, controls, and consuming-screen artboards after
design feedback. The package-owned runtime implements the same layout. The existing owning routes and mobile/desktop screen components
remain the review entry points. The removed-consumer workspace is aligned with
the [removed content previews plan](../../plans/removed-content-previews.md).

## View Controls

Place one compact icon toolbar beside the page title. It contains a native
viewport dropdown (Mobile, Desktop, Both), a light/dark toggle, and, on consuming
screens, a Highlight components toggle. Do not repeat the theme control in the
top bar or give highlighting a separate horizontal band. Icons have accessible
names, hover tooltips, selected states, and visible keyboard focus.

Use centered SVGs for the menu and dropdown chevron, avoiding text baselines.
Usage uses a connected-node icon with clear, separated strokes. Icon boxes do
not shrink; all glyphs are centered within their pointer targets.

The viewport dropdown switches the actual displayed preview contexts. Both shows
both mobile and desktop, with labels identifying each. Desktop content retains
its layout width when the available pane is narrow; scrolling happens inside the
preview pane instead of scaling the document or widening the outer page.
Theme changes affect the preview and its context labels, leaving the application
chrome legible. View changes preserve the selected variant and edited fields.

Native form state and scoped CSS make these mockup controls work without scripts,
including inside Browse's sandboxed frames. Preview fragments are authored from
the same fixture values for both contexts. They do not implement server rendering
of newly entered prop values. Highlighting uses the fixture's existing overlay
geometry and never dims an ancestor of a highlighted component.

Disable highlighting when no registered components exist, inspection is
unavailable, a comparison is selected, or the screen was removed and has no
current preview. The tooltip and accessible description
state that specific reason; zero usage must not be confused with missing data.
Highlight labels are separate rounded chips with a small gap above an intact
rounded outline. The chip must not overlap the outline's corner or obscure the
component; apply the same treatment to outer, nested, and single-instance regions.

## Fixed Shell And Resizable Inspector

The artboard fills its viewport. Its top bar, screen title, view toolbar, saved
variants, and comparison controls remain outside scrolling content. The enclosing
page and main column have no vertical scrollbar. The preview and inspector are
siblings on desktop; their contents may scroll independently without an enclosing
scroll region. The inspector's icon strip stays visible while its content scrolls.

On desktop, use the navigation divider's centered short-line handle, rotated to
resize vertically. The grip center sits on the divider border, with no vertical gap.
There is no diagonal corner grip or thick colored border. Both dividers share one
affordance: a 32×2px rounded strong-border grip at rest that turns accent-colored
with a soft accent halo while hovered, keyboard-focused, or being dragged, fading
between those states. Keyboard focus also draws an accent bar along the divider's
outer edge instead of a ring around the hit area. While a drag is in progress the
pointer keeps the resize cursor everywhere and preview frames ignore pointer input,
so the gesture cannot be interrupted by the content underneath.
The native sizing element sits behind the preview with its hit area centered
on the divider; it changes layout height without consumer scripts. Both panes
have minimum heights. Closing restores the preview's space; reopening retains
the resized split, clamped to the available workspace. Runtime resizing supports
the whole divider and keyboard input; native mockup dragging uses its center grip.

On mobile, keep the preview at full size and open the inspector above it as a
non-modal, full-workspace-width bottom sheet with safe-area spacing and a
centered iOS-style grabber. The workspace dock owns placement and height; the
inspector component owns the border, rounded surface and light shadow. The icon
strip and close action stay fixed at the top of the sheet. Only its content
scrolls. Closing leaves the icon strip at the bottom with no selected icon and
no sheet content or grabber.

The mockup grabber is a native switch: touch/click or Space toggles between
compact and expanded sheet heights without discarding edits or switching tabs.
The checked state exposes the expanded size to assistive technology. Runtime
implementation adds pan gestures and snap heights; the mockup does not claim
native iOS drag behavior. Background preview/header controls stay available.

## Nested Components

A component can render other registered components. On its page, the inspector
tab is named Nested components and lists those children, excluding the component
whose page is open. Toolbar demonstrates its nested Action instance. Leaf
components, including Action, omit this tab. Screen pages retain their Components
tab, including the existing explicit empty and unavailable states.

## Comparison Availability

Across the complete design catalogue, comparison controls require an explicit
change state; the shared header defaults to omitting them. Their band always has
an opaque background. Browse/tag-picker, shared-impact-only, ignored-only, and
empty designs retain Current without comparison controls.

All is a catalogue filter, not evidence that the selected example changed.
Known examples show Added, Changed, Removed, or Unmodified beside the title,
using the shown view's state. Resolve the selected screen or saved variant's
effective displayed scheme before reading that state: a light-only preview uses
Light status and marks while the catalogue's Dark preference stays selected.
One selected viewport and scheme maps `changed`,
`added`, and `removed` to their matching status, and `unchanged` or
`ignored-only` to Unmodified. Both uses the first status present in this order:
Changed, Added, Removed, Unmodified. Comparison controls follow that result:
Changed is eligible, as is Removed only for a component saved variant. If
neither a ready result nor matching screen-view evidence exists, retain the
route-level status and the entry or saved variant's independently supplied
eligibility. Never derive eligibility from fallback status. Evidence provenance
travels with both values, and viewport, effective-scheme, saved-variant, and
background-evidence changes recompute the shared decision without a page load.
When the shown view is Unmodified, its band
is absent and the view-control marks and `Changed views` row identify changed
views elsewhere. Removed screens show their badge without a comparison mode
row, over their previous version under
[removed previews](./mokly-removed-previews.md). Temporary prop
edits never create committed changes or make comparison controls appear.

Normal component/control fixtures depict an unchanged saved example and zero
catalogue changes. Changed component and independent screen-change fixtures
retain their explicit Changes counts and before/current presentation. A Removed
component variant retains before/current presentation; a Removed screen shows
its previous version.
Missing inspection metadata is distinct from comparison availability.

The runtime uses actual comparison eligibility for the selected saved example.
Missing, pending, or nonmatching per-view evidence uses the route-level status
fallback without changing that eligibility and cannot trigger eager screenshot
work merely to decide whether to show a mode row. The same rule gates comparison
deep links during server render, controlled selection, and later evidence
updates.
Affected consumers may still expose comparisons while staying out of Changes.

Entry status and variant status are distinct. Removing Compact from Action is
a Changed component with a comparable Removed variant; Farewell is a Removed
screen with no comparison controls.
The `design-component-variants` mockup depicts the inverse boundary: Action is
Changed because another saved example changed, while selected Disabled is
Unmodified and ineligible, so no comparison band appears.
The Added Badge example lives in States → Additions and shows its current saved
preview without comparison controls, plus one Changes entry. The existing unused Badge
example remains Unmodified. Status must never be inferred from usage counts.

## Comparison Details

Name the information icon Details. Keep comparison evidence, when present,
inside this panel alongside description and secondary source metadata. Do not
add a comparison disclosure below the canvas or a separate explanatory banner
above it. The panel remains available on a Removed screen's stage even though
that screen has no comparison modes. Ordinary Unmodified mockups omit the
comparison section; a shared-impact-only component keeps its file list in Details.
The `design-component-shared-impact` artboard in States → Shared impact depicts
that Unmodified component with its Details open and no comparison band.

Use structured evidence: entry/variant state, a generic output-change reason,
the component-level changed-file list and style outcomes, selected-variant
stylesheet exclusions, paired prop values, and links to changed components
actually used by the screen. The [CSS evidence contract](./mokly-css-evidence-shell.md#component-details-copy)
owns the exact component and variant sentences.
Prop rows identify their component instance and show Before and Current values.
The mockup fixtures share these values with the rendered preview and Props panel.
Do not invent explanations such as “corners and spacing changed”: the runtime
can populate factual rows from validated comparison/usage records and paired
inputs, but does not generate visual-analysis prose. Temporary control edits
remain separate from saved comparison evidence.

## Verification

Capture regressions before implementing the changes. Exercise native viewport,
theme, and highlight controls from disk and inside served frames. Verify both
rendered contexts, independent mask ids, correct labels, retained control values,
leaf/composite tab membership, and explicit comparison eligibility.

Use pointer dragging on the centered desktop grip, and touch/Space on the mobile
grabber. Check bounds, closing/reopening, retained edits and preview dimensions,
and document/main/inspector scrolling separately at mobile and desktop sizes.
Verify centered menu/caret SVGs and clear Usage geometry at both sizes.
Keep existing link, prop, usage, highlight-geometry, and Changes-count assertions.
Open and visually inspect every changed artboard and the interactive Both/Dark
states. Regenerate with `npm run example:build`, verify with
`npm run example:check`, and run `npx playwright test tests/browser/component*.spec.ts`.
Finish with `cargo xtask check`, commit/push, and the post-push review.
