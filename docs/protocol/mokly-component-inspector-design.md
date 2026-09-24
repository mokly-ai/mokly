# Component Inspector Design

## Delivery Status

Design revision for Milestones 4b, 4c, and 4g of the
[component explorer plan](../../plans/component-explorer.md). It replaces the
single crowded Details disclosure in component and consuming-screen mockups.
The runtime inspector implements the same layout and interaction. Existing non-component Browse/Changes
artboards continue to document the currently implemented shell. Removed
consumer stages retain this inspector around the previous version delivered by
the [removed content previews plan](../../plans/removed-content-previews.md).
The removal of dependency display is planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
implemented in Milestone 2 mockups and Milestone 5 UI. Neither the mockup nor
the runtime displays the old row.

## One Inspector

Component pages and consuming-screen designs share one inspector: beneath the
preview on desktop and in a floating bottom sheet on mobile. Its icon strip
contains Details, Props (Controls on editable component
designs), and Usage. Screens also have Components; composed components have
Nested components, while leaves omit it. Each icon has an accessible name, visible focus
style, and a tooltip. Only the active icon has the sage selected treatment.

Details contains the description, secondary source/reference metadata, and any
comparison evidence. Comparison facts never occupy a separate canvas disclosure
or header banner. The panel remains available on Removed screen stages even
though those screens expose no comparison modes.
Evidence availability, comparison-mode eligibility, and the initially open
inspector panel are independent authored states. In particular, the Added screen
mockup includes its factual branch evidence in Details while remaining
current-only and initially closed; an artboard must explicitly choose whether
Details starts open.
Components contains the nested instance tree and explicit empty/unavailable
states. Props contains the selected variant or instance's supplied values,
slot ownership, and Open component/Highlight actions. Controls replaces the
read-only props presentation where editable controls are being designed.
Usage contains Used by and, when relevant, Affected screens, with independent
screen Changes membership preserved. Never combine the entire tree, all props,
and all usage lists into one panel.

Clicking an icon opens that panel, switching directly from any other open panel.
Clicking the active icon closes it. A visible close affordance belongs to the
active disclosure and performs the same action. When closed, no icon is selected
and no panel content occupies layout space. Enter and Space activate the focused
icon; normal Tab navigation reaches icons and controls. No script is required
for the mockups' disclosure behavior. It must also work in sandboxed Browse
frames and directly from disk. The runtime implementation additionally supports
Escape and focus return as specified by the explorer contract.

Both layouts use a bounded, scrollable panel inside a fixed shell. Desktop uses
the navigation divider's centered short-line grip to resize the inspector.
Mobile uses a full-workspace-width rounded sheet over the preview with an
iOS-style grabber; the inspector owns its border, corners and shadow while its
dock owns placement and height. The mockup grabber toggles compact/expanded
heights without scripts. Closing leaves the icon strip at the bottom. The
enclosing page and main column do not scroll. The icon strip remains separate
from scrolling panel content. The
[workspace design](./mokly-component-workspace-design.md) owns the exact pane,
resize, and grouped view-control behavior.
Each owning artboard declares its initial panel explicitly; instance links open
the supplied-props panel for that instance. Empty/unavailable screens open the
Components panel. The canonical component page opens Details.

## Navigation And Metadata

Artboards contain no navigation footer for browsing mockup states. The existing
Design catalogue hierarchy links every owning page and its child galleries.
Saved-variant, usage, component, and instance links remain inside the depicted
product where they belong. Every `aria-current="page"` link must point to the
rendered artboard id, even when multiple states share a component/screen title.
Selection within a component or tree can use non-page current-item semantics.

Use stable fixture identities for catalogue selection. Display labels never
identify the current destination or synthesize a filename. Component fixtures
explicitly declare display name, id, source path, and description;
render the same metadata in Details and source references.

## Owning Closed States

The existing component and inspection artboards cover open panels. A separate
bounded Inspector gallery adds closed-panel states, each with its own mobile and
desktop screen component:

| Entry id                                   | Route                                        | State                                      |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------ |
| `design-component-inspector-closed`        | `design/components/inspector/component.html` | Component with all inspector panels closed |
| `design-component-screen-inspector-closed` | `design/components/inspector/screen.html`    | Screen with all inspector panels closed    |

## Verification

Browser tests open each icon, switch and close panels, exercise keyboard focus,
verify that closed panels reserve no space, and inspect both viewport layouts.
Catalogue checks cover all owning routes and every current-page destination.
Regression tests verify explicit Help hint source metadata and the removal of
footer navigation. Preserve component highlight geometry and attribution checks.
