# Component Explorer Design

## Owning Catalogue

The [component design inventory](./mokly-component-design-inventory.md) lists
all fifty-three component design entries (fifty-one screens and two variants)
and their owning folders.

## Component Pages

Component pages use the top bar, split navigation tree, screen heading,
comparison band, stage, and comparison controls of the shell designs, plus the
shared icon inspector and compact view toolbar. Components use the
stacked-layers icon of the Components panel in the Components section. Both sections are views of one tree, so the
`Example` folder appears above `Screens` in Specs and above its `Components`
library in Components, and component crumbs read `Example › Components`. A
variant's page keeps its parent's title as the heading; the browser title and
the route announcement name the variant first, then the parent:
`Default · Action · Mokly` and `Loaded Default · Action · Mokly`. The
path chip and Details show the shown entry's path, such as
`example/components/action/default`, with Details listing it above the source.
Desktop keeps the resizable navigation;
mobile keeps the compact header and adds short Screen/Components/Changes links
above the heading so the relevant destinations and change count stay visible.

The saved-variant strip follows the title and, for an eligible shown view, the comparison band. Known unchanged shown views show Unmodified beside the title, with no comparison row unless a shown view uses a changed component that the entry detail names, under the [screen controls](./mokly-changes-controls.md#screen-controls). The strip lists
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
The viewport dropdown shows the mobile canvas, desktop canvas, or both for the selected variant. Mobile context keeps the shell's fixed 390px width and desktop context keeps the shell's fixed 1024px layout width in every window, so each view has one layout width, and a narrower preview pane scrolls. Both places the two canvases side by side, 40px apart: centred while the row fits, otherwise from the left edge of the scrolling pane, and stacked from the left edge below 760px. Each canvas is the shell's: its viewport caption stands above a
520px frame with an 8px radius and a light border, without device chrome. The
component stands 24px from the frame's top left, where the shell's documents
draw it, in each canvas and comparison frame.
Consuming screens depict the same Action and Toolbar examples as the component
pages.

A comparison draws the shell's sections. Each section's heading names its
viewport and the variant's state, such as `Desktop · Variant changed`, and the
component frames below it have no caption. Side by side draws one component
frame per version under Before and Current labels. Overlay and Difference draw
one component frame of the same size around the viewport both versions share:
Current sits on top at half opacity, or blends by difference over the opaque
Before layer, and both versions always share one scroll position. The Stacked
comparisons gallery also depicts a synthetic Checklist taller than that frame,
part-way down with the frame's scrollbar drawn. Its Current version rewords one step, and its fixed-height
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
States links an Additions child gallery with one added Badge example and one
Changes entry, so States keeps its five-screen limit and its unused state.
It also links the Loading and recovery child gallery. That gallery shows
`Loading usage…` without counts or lists, screen inspection with
`Waiting for the component preview.`, and `Usage couldn’t be loaded.` with a
`Try again` button. Its Props loading and Props failed states show the Props
tab with `Loading props…` and no fields, and with `Props couldn’t be loaded.`
and `Try again`. Loading and failed states never reuse validated-empty or
unavailable-metadata copy.
Its Stylesheet evidence child gallery holds four screens of three stories that
change only `styles/actions.css`. In Component with changed styles, the changed
rule styles only Action's own output: Action and its three saved variants have
four Changes rows, each Side by side section reads "Styles this variant uses
changed" after its viewport, and Welcome and Details appear only under Affected
screens. Screen affected by a changed component opens Welcome from that list in
Side by side, under All, where Welcome stays Unmodified and outside Changes.
Its band offers
the comparison, and the shown view reads "Components this screen uses
changed" over its two versions; a component in Welcome's position reads
"Components this variant uses changed". Its Details list the
stylesheet with the styles that apply to Welcome, link Action, and end with
"Changed components that this screen uses affect its preview."; a component
in Welcome's position ends with "Changed components that this variant uses
affect its preview." In Styles outside a
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

Mask geometry is fixed to the synthetic artboard's layout and matches its
actual DOM bounds. The runtime owns geometry collection, selection, Escape
handling, and cleanup. Comparison artboards disable highlighting, as does
a Removed screen because it has no current preview to inspect.
An empty usage list says no registered components are used in this view;
unavailable inspection never claims a zero count. Badge has a visible saved
example and an explicit empty Used by list.

Disabled highlight controls explain whether there are no registered components,
inspection is unavailable, a comparison is selected, or the screen was removed. Highlight chips have a
small gap above an intact rounded outline, shared by all three region layouts.
