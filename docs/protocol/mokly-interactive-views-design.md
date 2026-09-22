# Interactive Views Design

## Delivery Status

Approved mockup scope for Milestone 2 of the
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
canonical screen shows a product screen in Live, followed by links to the
child galleries outside the artboard. Every screen has separate mobile and
desktop components. The screens reuse the existing shell, view toolbar,
artboard, device frames and icon inspector parts; they add no new shell
chrome. The page is reached from the design navigation and from the component
workspace page.

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
