# Component Explorer Design

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Owning Catalogue

The [component design inventory](./mokly-component-design-inventory.md) lists
all fifty component design entries (forty-eight screens and two variants), their
owning folders, and stylesheet scopes.

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
above the heading so the relevant destinations and change count stay visible.

The saved-variant strip follows the title and, for an eligible shown view, the comparison band. Known unchanged shown views show Unmodified beside the title, with no comparison row. The strip lists
the parent's own entry first, then each saved variant in authored order: Action,
Default, Disabled, and Secondary. The shown entry uses a pale sage surface,
border, and explicit current-link state. Default and Disabled are Action's
variant entries, each its own catalogue entry and Changes row under the
[variant contract](./mokly-variants.md). A scenario, or story, is the depicted
catalogue state that a group of artboards shares: which entries exist and which
changed. An option links to the artboard that shows its entry, whether that
artboard depicts the All or the Changes filter; an entry without an artboard is
a depiction. The Additions story, the stylesheet stories, and the controls limit
pages each depict a story of their own: on their pages every option except the
shown entry is a depiction, and no option on another page links into them.
Navigation variant rows follow the same rule.
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

The inspector separates Details (description/source/references), Nested components (present only when the component has children), Props (supplied values or editable fields), and
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
viewport, and no comparison band. The catalogue-wide Appearance selector is
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
artboards render with these counts.

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
Its Stylesheet evidence child gallery holds three stories that change only
`styles/actions.css`. In Component with changed styles, the changed rule styles
only Action's own output: Action and its three saved variants have four Changes
rows, Side by side reads "Default variant · Styles this variant uses changed",
and Welcome and Details appear only under Affected screens. In Styles outside a
changed component, the rule also styles Welcome's own Not now link, so Welcome
has its own row beside Action, five in all, and Details links Action to the
first story. Variants own no artboard there, so their rows and options stay
unlinked. Component with excluded styles opens an unchanged Action from All,
with excluded stylesheet evidence in Details and no comparison band or Changes row.
Comparison evidence appears only in the Details panel. Its typed fixture records
show output/variant changes, paired prop values, and related changed components;
they do not generate visual-analysis prose or a separate banner. See the
[workspace evidence contract](./mokly-component-workspace-design.md#comparison-details).

## Screen Inspection

The shared inspector puts component groups in Components, with native
disclosures, counts, and repeated-instance links. Selecting an instance opens
Props with its supplied values, slot/ownership details, and an Open component
link. Details and Usage stay available without crowding the selected instance. Welcome has four
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
its actual DOM bounds. The runtime owns geometry collection, selection, Escape
handling, and cleanup. Comparison artboards disable highlighting, as does
a Removed screen because it has no current preview to inspect.
An empty usage list says no registered components are used in this view;
unavailable inspection never claims a zero count. Badge has a visible saved
example and an explicit empty Used by list.

Disabled highlight controls explain whether there are no registered components,
inspection is unavailable, a comparison is selected, or the screen was removed. Highlight chips have a
small gap above an intact rounded outline, shared by all three region layouts.

## Verification And Maintenance

Mokly renders every artboard from its spec; never hand-write artboard HTML. Six
shared component stylesheets are hand-authored public inputs, scoped to the
`design/components/**/index.html` documents.
Route-scoped rules link the required mixed/global sheets from the fifty
component design routes. Registered components declare exclusive CSS through
`stylesheets`; the `$componentStylesheets` marker keeps those links between base
and layout sheets. Shared metadata supplies related docs, while folder records
supply navigation. Source paths supply no comparison evidence. The controls
stylesheet stays scoped to its twenty owning entries. Watched Serve reloads
configured and declared CSS. Shared fixtures and screen parts live beside their
owning screen modules.

The Rust behaviour tests over the design catalogue classify all nine shared
sheets once per scenario. Rendered stylesheet links pin 50, 20, 0, or all
`design/` screens and 69 component saved-variant entries. A parent component
renders its own views from its own props. The tests keep exact per-entry
rendered-resource records and rule records, the exact changed-entry union, and
no affected consumers for unresolved shared rules. They exclude unrelated
design screens, product screens and their use case.
`design.css` is rendered-resource evidence; it supplies no shared impact.

Run the component specs of the browser suite against `mokly serve` with
`npm run test:browser -- tests/browser/component*.spec.ts tests/browser/design_component_stacks.spec.ts`.
The browser suite opens every artboard in the served Browse frames, checks
links, selection semantics, counts, missing states, responsive overflow, mask
geometry, and the stacked frames' layers, blending, single scroller and drawn
offset; the Rust behaviour tests pin the stacked frames' structure, tie every
comparison caption to its recorded change, and pin the Checklist's Changes.
Visually inspect all rendered mobile and desktop pages in the served frames and
in the `mokly build` output, including both selected-instance states.
Run `cargo xtask check` before committing and pushing. After the push, use the
`implementation-review` skill against `origin/main` and report findings
without changing the implementation.
