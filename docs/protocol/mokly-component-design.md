# Component Explorer Design

## Delivery Status

The [component explorer plan](../../plans/component-explorer.md) records
delivery of the complete mobile/desktop mockup set for sign-off. The
[icon inspector revision](./mokly-component-inspector-design.md) and
[prop controls designs](./mokly-component-controls-design.md) extend the
original pages and inspection states. The [workspace revision](./mokly-component-workspace-design.md) owns the grouped view controls, bounded panes, resizable inspector, and comparison eligibility. Runtime registration, attribution,
inspection, and local editable previews implement these designs. Published
catalogues expose read-only saved props. These designs
extend the [shell design](./mokly-shell-design.md) and depict the
[component explorer contract](./mokly-component-explorer.md). The former
consumer's previous-version state is implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).
The stacked component comparisons depict the implemented
[comparison pane contract](./mokly-comparison-panes.md): the explorer holds a
saved variant's two versions in one bordered frame whose viewport scrolls both
as one. Their comparison bands also depict the implemented Scroll together
switch of the
[Scroll together contract](./mokly-comparison-scroll-together.md#reader-control).
The path-derived files, the Specs section, and the component paths in Details
below are the approved contract. These designs depict the kind-filtered
sections and component paths, and the catalogue uses paths. The runtime renders
the same Specs section.
The Loading and recovery child gallery depicts entry-scoped Usage loading,
inspection waiting, and retryable delivery failure.

## Owning Catalogue

Source lives under `examples/basic/specs/design/components/`; generated
artboards live under `examples/basic/generated/<path>/` as their path-derived
`index.<viewport>.html` views. The existing
Pages → Design → Component explorer folder reaches every
screen.
The canonical `overview` screen shows a component page, followed by links to the
owning child pages outside the artboard. The original Pages, Inspection, and States child folders are gallery
indexes, each with at most five direct owning screens; inspection also links a nested
selection gallery with two owning screens, and Pages links a nested Stacked
comparisons gallery with three. The Inspector gallery adds two closed
states. Controls has one canonical parent screen and Editing, States, and
Published galleries with four, four, and two screens. The linked inspector and
controls contracts own their additional entry inventories. Every screen has a separate
mobile component and desktop component; there are no new user-flow pages.

| Entry                                                       | State                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `design/components/overview`                                | Action page, default variant, props, and Used by          |
| `design/components/pages/variants`                          | Disabled saved variant                                    |
| `design/components/pages/comparison`                        | Saved variant before/current comparison                   |
| `design/components/pages/stacked/overlay`                   | Saved variant Overlay in one bordered frame               |
| `design/components/pages/stacked/difference`                | Saved variant Difference in one bordered frame            |
| `design/components/pages/stacked/overlay-tall`              | Component taller than its frame, part-way down in Overlay |
| `design/components/pages/affected`                          | One changed component and two affected screens            |
| `design/components/pages/toolbar`                           | Component consuming Action                                |
| `design/components/pages/help`                              | Invoked component with no visible region                  |
| `design/components/inspection/inspection-details`           | Repeated instances and selected props                     |
| `design/components/inspection/inspection-highlight`         | Outermost component cutouts                               |
| `design/components/inspection/inspection-nested`            | Nested Action selected in the screen and Props            |
| `design/components/inspection/inspection-direct-change`     | Independent screen prop change; two Changes               |
| `design/components/inspection/inspection-consumer`          | A second screen reached from Used by                      |
| `design/components/inspection/selection/inspection-toolbar` | Selected container with its own props                     |
| `design/components/inspection/selection/inspection-help`    | Selected invisible instance                               |
| `design/components/states/empty`                            | Validated empty usage                                     |
| `design/components/states/unavailable`                      | Missing inspection metadata                               |
| `design/components/states/unused`                           | Saved component with no consumers                         |
| `design/components/states/removed`                          | Removed saved variant and former consumer                 |
| `design/components/states/removed-consumer`                 | Former consumer's previous version behind a Removed badge |
| `design/components/states/additions/added`                  | Added Badge current preview without comparison controls   |
| `design/components/states/shared-impact/shared-impact`      | Unmodified Action with shared-file evidence in Details    |

| `design/components/states/loading/usage-loading` | Component Usage waiting for private entry evidence |
| `design/components/states/loading/inspection-loading` | Screen inspection waiting for displayed-view usage |
| `design/components/states/loading/usage-failed` | Usage read failure with a Try again action |

The Loading and recovery folder sits below Empty and change states and contains
exactly these three states. Each entry's files derive from its path under the
[artifact path contract](./mokly-artifact-paths.md): its standalone views are
`<path>/index.mobile.html` and `<path>/index.desktop.html`, and gallery
membership is the entry's folder. All thirty-nine component
screens opt into light documents, matching the existing shell mockups. Their
depicted preview caption names the artboard's own scheme, and the toolbar has
no scheme switch: the catalogue's one Appearance control, drawn in their top
bar like every other artboard's, sets it. Links use
the path-addressed [link contract](./mokly-authoring.md#links) so they work
both directly from disk and in Browse. State links demonstrate navigation between mockups; static
depictions of shell controls do not implement the separate runtime inspector.

The shared shell retains the [existing design navigation](./mokly-design-links.md)
for brand, home breadcrumb, and the canonical mobile drawer. Component artboards
select their own typed navigation state; they never inherit Welcome's tag,
scheme, inspector, or comparison transitions. Their viewport dropdown and highlight switch work through native form state and CSS. Comparison depictions retain native button focus and pressed states only in eligible change scenarios. In Side by side, Overlay and Difference the band also draws the Scroll together switch, on, after the mode control and before Refresh, as the [shell design](./mokly-shell-design.md#in-place-comparisons) specifies; it toggles in place.
Action's changed Default variant is one comparison family: its mode control
links Current to `design/components/pages/affected`, Side by side to
`design/components/pages/comparison`, and Overlay and Difference to
`design/components/pages/stacked/overlay` and `design/components/pages/stacked/difference`, while the
selected mode stays a pressed button. Every other eligible depiction, including
the tall Checklist, keeps all four modes as buttons. No mode control links into
the Checklist, because it depicts another component; readers reach it beside
Overlay and Difference in its owning Stacked comparisons gallery.
The shared selection control preserves native anchor semantics when an authored
transition exists. Existing Browse and Changes artboards retain their non-link
spans for unsupported controls.

## Component Pages

Reuse the existing top bar, split navigation tree, screen heading, comparison band,
stage, and comparison controls, adding the shared icon inspector and compact view toolbar. Components use a small cube
icon in the Components section. Both sections are views of one tree, so the
`Example` folder appears above `Screens` in Specs and above its `Components`
library in Components, and component crumbs read `Example › Components`. The
path chip and Details show the shown entry's path, such as
`example/components/action/default`, with Details listing it above the source.
Desktop keeps the resizable navigation;
mobile keeps the compact header and adds short Screen/Components/Changes links
above the heading so the relevant destinations and change count remain visible.

The saved-variant strip follows the title and, for an eligible shown view, the comparison band. Known unchanged shown views show Unmodified beside the title, with no comparison row. The selected variant uses
a pale sage surface, border, and explicit current-link state. Default and
Disabled are Action's variant entries, each its own catalogue entry and Changes
row under the [variant contract](./mokly-variants.md); the strip links to them.
The viewport dropdown shows the mobile canvas, desktop canvas, or both for the selected variant. Mobile context is capped at 390px; desktop context uses the available width with a 720px minimum inside the scrolling preview pane. Canvases have a 10px radius, a light
border, a small context caption, and a centered component, without device chrome.
The same `ActionExample` and `ToolbarExample` are reused in consuming screens.

Side by side draws one canvas per version under Before and Current labels.
Overlay and Difference draw one bordered frame at the same canvas height, its
caption above the viewport both versions share: Current sits on top at half
opacity, or blends by difference over the opaque Before layer, and both versions
always share one scroll position. The Stacked comparisons gallery also depicts
a synthetic Checklist taller than that frame, part-way down with the frame's
scrollbar drawn. Its Current version rewords one step, and its fixed-height
rows keep the drawn position independent of text wrapping. Its own one-entry
Changes scenario lists only Checklist, which no screen uses yet, so its
inspector opens on Details, where the comparison facts live.

The inspector separates Details (description/source/references), Nested components (present only when the component has children), Props/Controls (supplied values or declared editable fields), and
Usage (Used by plus Affected screens). Only one panel is open at a time. Click
its icon again or its close affordance to collapse it; no icon is then selected.
Its content scrolls below a fixed icon strip. Desktop uses the navigation
divider's centered grip to resize the split. Mobile opens a rounded bottom sheet
over the preview; its iOS-style grabber toggles compact/expanded heights in the
mockups. The outer page does not scroll.
Props use a definition list and monospace values. Usage rows show screen or
component titles, direct/transitive relationships, instance counts, and view
counts derived from the synthetic usage fixture. Source paths are explicit
fixture metadata, never derived from display titles. Design navigation belongs
to the catalogue hierarchy; no design-only footer appears in the artboards.

The Action fixture is used twice in Welcome (directly and through Toolbar), once
in Details, and once by Toolbar's default variant. Its usage has four contexts:
mobile/desktop × light/dark. A component-only appearance edit produces exactly
one Changes row, Action; Welcome and Details appear under Affected screens.
An independent Welcome label edit adds Welcome, making two Changes rows.
The removed-state scenario also retains the former Farewell consumer and links
it to its Removed state, which
[removed previews](./mokly-removed-previews.md) fill with its previous version:
the “Showing previous version” label, the historical frame for the selected
viewport, and no comparison band. The catalogue-wide Appearance selector remains
the only theme control, while the historical frame stays Light because that is
the only scheme captured for the view. Its stage carries no escape link,
because the catalogue navigation keeps Action's affected list one step away.
Farewell is independently removed, so that
scenario's Changes rows include the removed Compact entry and Farewell. The
Removed Compact variant entry keeps its before/current comparison and explicit
missing current side; Farewell has no comparison band.

Because every variant is its own entry, the depicted Changes counts include
one row per changed or removed variant, the parent row carries the aggregate
mark rather than a status of its own unless the parent itself changed, and the
Action badges describe the variant entry on stage. The design catalogue
artboards are regenerated with these counts when the example is converted.

Every known shown view carries an Added, Changed, Removed, or Unmodified badge
beside its title. In the removed scenario Compact is its own Removed entry
beneath Action and reads Removed when selected; Farewell is Removed.
States links an Additions child gallery with one new Badge example and one Changes
entry, preserving the five-screen limit in its parent and the existing unused state.
It also links the Loading and recovery child gallery. That gallery shows
`Loading usage…` without counts or lists, screen inspection with
`Waiting for the component preview.`, and `Usage couldn’t be loaded.` with a
`Try again` button. Loading and failed states never reuse validated-empty or
unavailable-metadata copy.
Its Shared impact child gallery shows an unchanged Action component opened from
All, with a changed-file list in Details and no comparison band or Changes entry.
Comparison evidence appears only in the Details panel. Its typed fixture records
show output/variant changes, paired prop values, and related changed components;
they do not generate visual-analysis prose or a separate banner. See the
[workspace evidence contract](./mokly-component-workspace-design.md#comparison-details).

## Screen Inspection

The shared inspector puts component groups in Components, with native
disclosures, counts, and repeated-instance links. Selecting an instance opens
Props with its supplied values, slot/ownership details, and an Open component
link. Details and Usage remain available without crowding the selected instance. Welcome has four
instances: Toolbar, two Actions, and an invisible Help hint. Nested Toolbar
contents start collapsed and expand in the nested-selection artboard. Help hint
has an inspection entry and component page, without an invented visible region.
Toolbar and Help hint usage links lead to their own selected-instance artboards,
with the correct prompt or visibility props and Open component destination.

Highlight components is a native switch grouped with the viewport dropdown beside the title. It toggles the overlay without navigation. The enabled artboards show a light mask at 78% coverage with cutouts over the visible
components. Sage outlines and named labels expose the selected regions; a
nested selection cuts out only the Toolbar action and dims the parent again.
The same consumer DOM is used with highlighting off and on. Welcome uses an SVG overlay; Details uses a clipped scrim around its single Action. Neither sets ancestor opacity. Each viewport uses its own overlay, with unique SVG mask ids when Both is selected.

Mask geometry is fixed to the synthetic artboard's layout and tested against
its actual DOM bounds. Runtime geometry collection, selection, Escape handling,
and cleanup are implemented. Comparison artboards disable highlighting, as does
a Removed screen because it has no current preview to inspect.
An empty usage list says no registered components are used in this view;
unavailable inspection never claims a zero count. Badge has a visible saved
example and an explicit empty Used by list.

Disabled highlight controls explain whether there are no registered components,
inspection is unavailable, a comparison is selected, or the screen was removed. Highlight chips have a
small gap above an intact rounded outline, shared by all three region layouts.

## Verification And Maintenance

Use the real generator; never hand-edit generated HTML. Six shared component
stylesheets are hand-authored public inputs, scoped to the component design
entries' generated documents.
Route-scoped stylesheet matching links them only from the thirty-nine component design routes;
Changes follows those rendered resources. Shared metadata supplies dependency
lists to each definition. Controls extends that list with its own stylesheet,
scoped to eleven entries with a matching watch rule. Keep those stylesheets out
of global `review.sharedImpact`; watched rules still reload their edits.
Shared fixtures and reusable screen parts live beside the owning screen modules.

`tests/component_design_attribution.test.ts` exercises each component stylesheet
against the real example configuration and current compiled manifest through the rendered-resource graph and changed-entry projection. It requires exact
Changes membership for the component design entries, excluding unrelated design screens,
product screens, and their use case.

Run `npm run example:build`, `npm run example:check`, and
`npx playwright test tests/browser/component*.spec.ts tests/browser/design_component_stacks.spec.ts`.
The browser suite opens every artboard directly from disk, checks links,
selection semantics, counts, missing states, responsive overflow, mask
geometry, and the stacked frames' layers, blending, single scroller and drawn
offset; `tests/design_component_stacks.test.ts` pins their structure,
`tests/design_component_comparison_states.test.ts` ties every comparison
caption to its recorded change and pins the Checklist's Changes, and
`tests/design_screen_counts.test.ts` keeps the documented screen counts
aligned with the catalogue. Visually inspect
all generated mobile and desktop pages, including both selected-instance states.
Run `cargo xtask check` before committing and pushing. After the push, use the
[implementation review prompt](../implementation-review-prompt.md) against
`origin/main` and report findings without changing the implementation.
