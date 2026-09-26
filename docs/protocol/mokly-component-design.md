# Component Explorer Design

## Delivery Status

Milestones 4, 4a, 4b, 4c, 4f, 4g, and 7 of the [component explorer plan](../../plans/component-explorer.md)
deliver the complete mobile/desktop mockup set for sign-off. The
[icon inspector revision](./mokly-component-inspector-design.md) and
[prop controls designs](./mokly-component-controls-design.md) extend the
original pages and inspection states. The [workspace revision](./mokly-component-workspace-design.md) owns the grouped view controls, bounded panes, resizable inspector, and comparison eligibility. Runtime registration, attribution,
inspection, and local editable previews implement these designs. Published
catalogues expose read-only saved props. These designs
extend the [shell design](./mokly-shell-design.md) and depict the
[component explorer contract](./mokly-component-explorer.md). The former
consumer's previous-version state is implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).
The Loading and recovery child gallery is implemented by Milestone 2 of the
[route-scoped bootstrap plan](../../plans/route-scoped-shell-bootstrap.md).

## Owning Catalogue

Source lives under `examples/basic/entries/design/components/`; generated
artboards live under `examples/basic/generated/design/components/`. The existing
Pages → Design → Mokly design → Component explorer collection reaches every
screen.
The canonical `overview` screen shows a component page, followed by links to the
owning child pages outside the artboard. The original Pages, Inspection, and States child collections are gallery
indexes, each with at most five direct owning screens; inspection also links a nested
selection gallery with two owning screens. The Inspector gallery adds two closed
states. Controls has one canonical parent screen and Editing, States, and
Published galleries with four, four, and two screens. The linked inspector and
controls contracts own their additional route inventories. Every screen has a separate
mobile component and desktop component; there are no new user-flow pages.

| Entry id                                    | Route                                                 | State                                                     |
| ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| `design-component-overview`                 | `design/components/overview.html`                     | Action page, default variant, props, and Used by          |
| `design-component-variants`                 | `design/components/pages/variants.html`               | Disabled saved variant                                    |
| `design-component-comparison`               | `design/components/pages/comparison.html`             | Saved variant before/current comparison                   |
| `design-component-affected`                 | `design/components/pages/affected.html`               | One changed component and two affected screens            |
| `design-component-toolbar`                  | `design/components/pages/toolbar.html`                | Component consuming Action                                |
| `design-component-help`                     | `design/components/pages/help.html`                   | Invoked component with no visible region                  |
| `design-component-inspection-details`       | `design/components/inspection/details.html`           | Repeated instances and selected props                     |
| `design-component-inspection-highlight`     | `design/components/inspection/highlight.html`         | Outermost component cutouts                               |
| `design-component-inspection-nested`        | `design/components/inspection/nested.html`            | Nested Action selected in the screen and Props            |
| `design-component-inspection-direct-change` | `design/components/inspection/direct-change.html`     | Independent screen prop change; two Changes               |
| `design-component-inspection-consumer`      | `design/components/inspection/consumer.html`          | A second screen reached from Used by                      |
| `design-component-inspection-toolbar`       | `design/components/inspection/selection/toolbar.html` | Selected container with its own props                     |
| `design-component-inspection-help`          | `design/components/inspection/selection/help.html`    | Selected invisible instance                               |
| `design-component-empty`                    | `design/components/states/empty.html`                 | Validated empty usage                                     |
| `design-component-unavailable`              | `design/components/states/unavailable.html`           | Missing inspection metadata                               |
| `design-component-unused`                   | `design/components/states/unused.html`                | Saved component with no consumers                         |
| `design-component-removed`                  | `design/components/states/removed.html`               | Removed saved variant and former consumer                 |
| `design-component-removed-consumer`         | `design/components/states/removed-consumer.html`      | Former consumer's previous version behind a Removed badge |
| `design-component-added`                    | `design/components/states/additions/added.html`       | Added Badge current preview without comparison controls   |
| `design-component-usage-loading`            | `design/components/states/loading/usage.html`         | Component Usage waiting for private route evidence        |
| `design-component-inspection-loading`       | `design/components/states/loading/inspection.html`    | Screen inspection waiting for displayed-view usage        |
| `design-component-usage-failed`             | `design/components/states/loading/failed.html`        | Usage read failure with a Try again action                |

The Loading and recovery gallery uses the
`design-component-loading-states` collection at segment `loading`, nested under
`design-component-states` after the existing Additions collection.

Standalone files insert `.mobile` or `.desktop` before `.html`. All thirty-five
component screens opt into light documents, matching the existing shell mockups. Their
depicted preview caption names the artboard's own scheme, and the toolbar has
no scheme switch: the catalogue's one Appearance control, drawn in their top
bar like every other artboard's, sets it. Links use
the existing logical-id navigation contract so they work both directly from
disk and in Browse. State links demonstrate navigation between mockups; static
depictions of shell controls do not implement the separate runtime inspector.

The shared shell retains the [existing design navigation](./mokly-design-links.md)
for brand, home breadcrumb, and the canonical mobile drawer. Component artboards
select their own typed navigation state; they never inherit Welcome's tag,
scheme, inspector, or comparison transitions. Their viewport dropdown and highlight switch work through native form state and CSS. Comparison depictions retain native button focus and pressed states only in eligible change scenarios.
The shared selection control preserves native anchor semantics when an authored
transition exists. Existing Browse and Changes artboards retain their non-link
spans for unsupported controls.

## Component Pages

Reuse the existing top bar, split navigation tree, screen heading, comparison band,
stage, and comparison controls, adding the shared icon inspector and compact view toolbar. Components use a small cube
icon in the Components section and its authored Components collection. Desktop keeps the resizable navigation;
mobile keeps the compact header and adds short Screen/Components/Changes links
above the heading so the relevant destinations and change count remain visible.

The saved-variant strip follows the title and, for an eligible shown view, the comparison band. Known unchanged shown views show Unmodified beside the title, with no comparison row. The selected variant uses
a pale sage surface, border, and explicit current-link state. Default and
Disabled are one component's variants; neither creates a separate Changes row.
The viewport dropdown shows the mobile canvas, desktop canvas, or both for the selected variant. Mobile context is capped at 390px; desktop context uses the available width with a 720px minimum inside the scrolling preview pane. Canvases have a 10px radius, a light
border, a small context caption, and a centered component, without device chrome.
The same `ActionExample` and `ToolbarExample` are reused in consuming screens.

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
scenario has two Changes rows: Action and Farewell. The Removed Action variant
keeps its before/current comparison and explicit missing current side; Farewell
has no comparison band.

Every known shown view carries an Added, Changed, Removed, or Unmodified badge
beside its title. Action's route-level state stays Changed when only Compact is
removed, while Compact reads Removed when selected; Farewell is Removed.
States links an Additions child gallery with one new Badge example and one Changes
entry, preserving the five-screen limit in its parent and the existing unused state.
It also links the Loading and recovery child gallery. That gallery shows
`Loading usage…` without counts or lists, screen inspection with
`Waiting for the component preview.`, and `Usage couldn’t be loaded.` with a
`Try again` button. Loading and failed states never reuse validated-empty or
unavailable-metadata copy.
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
stylesheets are hand-authored public inputs, confined to `design/components/**`.
Route-scoped stylesheet matching links them only from the thirty-five component design routes; Changes follows those rendered resource references. The collection also declares inherited dependencies for comparison evidence. The controls stylesheet is scoped
further to its eleven owning routes, with a matching dependency and watch rule. Keep them out of the global
`review.sharedImpact` list; watched stylesheet rules still reload their edits.
Child collection dependency lists replace inherited lists; Controls explicitly
spreads the shared stylesheet dependency set before adding its own stylesheet.
Shared fixtures and reusable screen parts live beside the owning screen modules.

`tests/component_design_attribution.test.ts` exercises each component stylesheet
against the real example configuration and current compiled manifest through the rendered-resource graph and changed-route projection. It requires exact
Changes membership for the component routes, excluding unrelated design screens,
product screens, and their use case.

Run `npm run example:build`, `npm run example:check`, and
`npx playwright test tests/browser/component*.spec.ts`. The browser suite
opens every artboard directly from disk, checks links, selection semantics,
counts, missing states, responsive overflow, and mask geometry. Visually inspect
all generated mobile and desktop pages, including both selected-instance states.
Run `cargo xtask check` before committing and pushing. After the push, use the
[implementation review prompt](../implementation-review-prompt.md) against
`origin/main` and report findings without changing the implementation.
