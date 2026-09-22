# Interactive Views Design

## Delivery Status

Delivered mockup scope for Milestone 2 of the
[interactive views plan](../../plans/interactive-views.md). These authored
design states depict the [interactive views contract](./mokly-interactive-views.md)
and extend the [shell design](./mokly-shell-design.md) and
[component workspace design](./mokly-component-workspace-design.md). The
runtime Static/Live control implements these designs in a later milestone.

## Static/Live Control

Add a two-option segmented control labelled Static and Live to the view
toolbar, immediately after the light/dark toggle and before Highlight
components. It uses the same segmented style, selected state, accessible
group name ("Preview mode"), hover tooltips and visible keyboard focus as the
viewport and scheme controls. Static is selected by default. The control
appears only on screen fragments and component saved variants of a catalogue
whose local Serve offers Live; pages, use-case steps, comparison panes and
removed previous versions never show it. A static-only catalogue, or an entry
that opted out, shows the existing toolbar unchanged, with no placeholder gap.

Selecting Live keeps the same artboard, device frames, labels, breadcrumb,
saved-variant strip and comparison band. The preview content itself is
identical in both modes; only the selected segment changes. No badge, banner
or caption announces the mode inside the device frame.

## Preparing And Unavailable

Preparing shows the device frame with a centered spinner and the line "Getting
the live preview ready", using the existing spinner treatment from Changes.
Static remains selectable during preparation; selecting it returns the static
document immediately.

Unavailable shows Static selected and the Live segment disabled with the
tooltip and accessible description "Live preview is unavailable for this
view." The reason stays out of shell copy. The artboard shows the static
document as normal.

## Inspector While Live

While Live is selected, the Props/Controls and Usage tabs keep their icons and
open normally, but their panels replace their content with one secondary line:
"Switch to Static to inspect or edit this view." Details remains unchanged.
Highlight components is disabled with the description "Highlighting works in
Static." Comparison controls are unchanged and open the comparison stage as
today; comparison panes have no Static/Live control.

## Owning Catalogue

Source lives under `examples/basic/entries/design/interactive/`; generated
artboards live under `examples/basic/generated/design/interactive/`. The
canonical screen shows a product screen in Live. Every screen has separate
mobile and desktop components. The screens reuse the existing shell, view
toolbar, artboard, device frames and icon inspector parts; they add no new
shell chrome.

| Entry id                              | Route                                           | State                                                       |
| ------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `design-interactive-overview`         | `design/interactive/overview.html`              | Welcome screen with Live selected                           |
| `design-interactive-static`           | `design/interactive/modes/static.html`          | Same screen with Static selected                            |
| `design-interactive-preparing`        | `design/interactive/modes/preparing.html`       | Live selected while the preview is being prepared           |
| `design-interactive-unavailable`      | `design/interactive/modes/unavailable.html`     | Live disabled, Static selected                              |
| `design-interactive-component`        | `design/interactive/workspace/component.html`   | Action saved variant in Live with the Props/Controls notice |
| `design-interactive-static-catalogue` | `design/interactive/workspace/static-only.html` | Toolbar of a catalogue without Live, no control             |

Overview is the canonical parent screen. Modes and Workspace are bounded child
galleries with three and two owning screens. All screens are light-only
documents, matching the existing shell mockups. Links use the logical-id
navigation contract so they work from disk and in Browse. Static depictions of
the control do not implement the separate runtime behaviour.

## Reaching These States

The control itself carries every transition, exactly as the theme and
comparison controls do; no design-only navigation is added inside or under an
artboard.

| Source                         | Segment | Destination                    |
| ------------------------------ | ------- | ------------------------------ |
| `design-browse-screen`         | Live    | `design-interactive-overview`  |
| `design-interactive-overview`  | Static  | `design-interactive-static`    |
| `design-interactive-static`    | Live    | `design-interactive-preparing` |
| `design-interactive-preparing` | Static  | `design-interactive-static`    |
| `design-component-overview`    | Live    | `design-interactive-component` |
| `design-interactive-component` | Static  | `design-component-overview`    |

Selecting Live for the first time prepares the preview, so the static screen
opens the preparing state while the ready pair keeps its own transition.
`design-interactive-unavailable` and `design-interactive-static-catalogue`
have no incoming control transition, because no product action reaches them:
they are entered from the catalogue navigation, exactly like the Changes
availability states. Unavailable is also the only artboard whose Live segment
is a described depiction instead of a link, and the static-only catalogue is
the only workspace with no segments at all.

Only the two canonical entry points — the selected Browse screen and the
component page — record a preview mode. Every other existing artboard keeps
its toolbar unchanged, which is also the depiction of a catalogue that never
offers Live. Each artboard declares its own mode, links and availability in
`entries/design/parts/navigation_states.ts`, so a screen that has not been
designed for Live cannot acquire the control implicitly.

Both Workspace screens show the Highlight components toggle so they differ
only by the preview-mode control: Live disables highlighting with its reason,
and the static-only catalogue keeps the ordinary enabled toggle.

## Shared Component

The control belongs to the registered `design-ui-view-controls` component, not
to a new control family. Its schema gains an optional `previewMode`, an
optional `previewModeDisabled` and an optional `previewModeDestinations`; the
existing highlight `unavailable` reason gains a `live` value. Its saved `live`
example shows Live selected with highlighting disabled. Exclusive sizing and
disabled-segment rules live in
`generated/design-library/controls/view-controls.css`; the segmented surface
itself stays the shared `.mbk-seg` style.

## Verification

Use the real generator and build/check every generated artboard. Keep
generated HTML and the manifest ignored in derived mode and commit the
authored changes only. Test the control's labels, selected states, disabled
state and accessible descriptions; the preparing spinner copy; the inspector
notice; the absent control on the static-only screen; and links between
owning states. Open every artboard from disk and inspect both viewport
variants. Run `npm run build`, `npm run example:build`,
`npm run example:check`, smoke the pages through `npm run dev`, then commit
and push.
