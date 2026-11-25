# Component Explorer Design

Status: A story that cannot render still stops the build, and the shell shows no Story or Storybook row yet. The [story render failures milestone](../../plans/storybook-support.md#milestone-24-story-render-failures) adds the error document, and the [Storybook link milestone](../../plans/storybook-support.md#milestone-28-the-storybook-link-in-the-shell) adds the rows.

## Owning Catalogue

The [component design inventory](./mokly-component-design-inventory.md) lists
the component explorer, Props, and Storybook stories design entries and their
owning folders.

## Component Pages

Component pages use the Canvas viewer of the shell designs. The canvas holds
the component's variant set between the top bar, the floating catalogue and
the right panel. The right panel holds Inspect and, where the Changes filter
lists the entry or the set offers the compare modes, Changes. Components use
the stacked-layers icon of the Components panel in the Components section.
Both sections are views of one tree, so the `Example` folder appears above
`Screens` in Specs and above its `Components` library in Components, and
component crumbs read `Example › Components`. A variant's page keeps its
parent's title as the heading; the browser title and the route announcement
name the variant first, then the parent: `Default · Action · Mokly` and
`Loaded Default · Action · Mokly`. The path chip and Details show the shown
entry's path, such as `example/components/action/default`, with Details
listing it above the source.

The variant set follows the
[canvas stage](./mokly-shell-canvas-stage.md#section), inside a dashed
outline. A row for the component's own example comes first, and the
component's title names its frames, such as `Action · Light`. One row for each
saved variant follows, and each row holds its Light frame beside its Dark
frame. Inspect's Variants section names the component itself first, then its
saved variants in authored order: the Action, then Default, Disabled, and
Secondary. Choosing a variant selects its Light frame, and Props edits that
variant.

The chosen variant reads in the ink colour, its mark takes the
deep signal colour, and it carries an explicit current-link state. Default and
Disabled are Action's variant entries, each its own catalogue entry and
Changes row under the [variant contract](./mokly-variants.md). Known unchanged
shown views show Unmodified beside the title, under the
[screen controls](./mokly-changes-controls.md#screen-controls). An entry with
such views has no Changes tab unless a shown row of its variant set compares
under those controls, such as another changed row or a row whose shown view
uses a changed component that its own entry detail names.

A depicted branch is the catalogue state that a group of artboards shares:
which entries exist and which changed. A Variants row links to the artboard
that shows its variant on the same branch, in the All or the Changes filter.
A variant without such an artboard is a depiction. Navigation variant rows
follow the same rule. Consuming screens depict the same Action and Toolbar
examples as the component pages.

A component compares on its variant set, row by row. Each row is its own entry
with its own comparison, under the
[selected comparison contract](./mokly-selected-comparisons.md). Each frame of
a compared row compares its own view in the chosen mode of the
[comparison panes](./mokly-comparison-panes.md). A row without a comparison,
such as an Added variant or an Unmodified row that uses no changed component,
keeps its current frames. A failed row shows the comparison failure on its own
frames, and the other rows still compare. Side by side shows one frame's two
versions next to each other, each in its own frame with a Before or Current
tag. A chip names each frame of a compared row as the frame's label does.
Overlay and Difference hold both versions in each frame of a compared row:
Current sits on top at half opacity, or blends by difference over the opaque
Before layer. Both versions of a frame share one size: the larger width and
the larger height of the two. On the depicted Action branch, no version before
is larger than its current version, so each frame keeps the size of its
current version.

Inspect holds the sections of the
[inspector design](./mokly-component-inspector-design.md#inspect). Selection
lists the selected instance's props in a definition list with monospace
values. Usage rows show screen or component titles, direct/transitive
relationships, instance counts, and view counts derived from the synthetic
usage fixture. Source paths are explicit fixture metadata, never derived from
display titles. Design navigation belongs to the catalogue hierarchy; no
design-only footer appears in the artboards.

The Action fixture is used twice in Welcome (directly and through Toolbar), once
in Details, and once by Toolbar's default variant. Its usage has four contexts:
mobile/desktop × light/dark. On the Action branch, a component-only edit of the
Action changes the Action and its three saved variants: four Changes rows.
Welcome and Details appear under Affected screens, as
`design/canvas/components/usage` depicts. An independent Welcome label edit
adds Welcome's own row, five in all, as
`design/canvas/components/affected/direct` depicts.

On the removal branch, the Action's Compact variant is its own Removed entry,
and the parent stays unmarked. The branch also removed Farewell, a screen
that rendered the Action with Compact's props, so Changes lists two entries:
Farewell, then Compact. `design/canvas/components/removed` keeps Compact on
the variant set after the current variants. Each of its frames says that it
has no current version, and Props keeps its saved props read-only. Its
comparison, `design/canvas/components/removed/changes`, keeps the explicit
missing current side and falls back to Side by side. Removing a saved variant
changes no current consumer's render, so Usage lists the Action's consumers,
and its affected list keeps only Farewell, a removed former consumer.

Farewell's row in the affected list reads `Farewell · Removed` and opens its
Removed state, `design/canvas/components/removed/consumer`, which
[removed previews](./mokly-removed-previews.md#behavior) fill with its
previous version: its Light frames under “Showing previous version”, with no
compare mode. The catalogue-wide Appearance selector is the only theme
control, while the historical frames stay Light because that is the only
scheme captured for the views. Inspect keeps Farewell's record, and
Highlight components is unavailable. The catalogue's Compact row returns to
Compact. Farewell's Changes tab,
`design/canvas/components/removed/consumer-changes`, is the first of the
branch's two changes and offers no compare mode, and its Next change opens
Compact's comparison.

Because every variant is its own entry, the depicted Changes counts include
one row per changed or removed variant, the parent row carries the aggregate
mark rather than a status of its own unless the parent itself changed, and the
Action badges describe the variant entry on stage. The design catalogue
artboards render with these counts.

Every known shown view carries an Added, Changed, Removed, or Unmodified badge
beside its title. In the removed scenario Compact is its own Removed entry
beneath Action and reads Removed when selected; Farewell is Removed.
`design/canvas/components/usage/loading` shows `Loading usage…` without counts
or lists, `design/canvas/components/inspection` shows screen inspection with
`Waiting for the component preview.`, and
`design/canvas/components/usage/failed` shows `Usage couldn’t be loaded.` with
`Try again`. `design/canvas/props/loading` shows Props with `Loading props…`
and no fields, and `design/canvas/props/loading/failed` shows
`Props couldn’t be loaded.` with `Try again`. Loading and failed states never
reuse validated-empty or unavailable-metadata copy.

`design/canvas/components/affected` opens Welcome from the Action's Affected
screens in Side by side, under All, where Welcome stays unmodified and outside
Changes. Its Changes tab offers the comparison without a stepper. Its
comparison details link Action and end with “Changed components that this
screen uses affect its preview.” A component in Welcome's position ends with
“Changed components that this variant uses affect its preview.”
`design/canvas/evidence/unchanged/action` opens an unchanged Action from All,
on a branch that changed only `styles/actions.css`. Its excluded stylesheet
evidence stays in Inspect, and it has no Changes tab or Changes row.
Comparison evidence appears only in the comparison details, or in Inspect for
an entry without Changes. Its typed fixture records show output/variant changes, paired prop
values, and related changed components; they do not generate visual-analysis
prose or a separate banner. See the
[workspace evidence contract](./mokly-component-workspace-design.md#comparison-details).

## Screen Inspection

Inspect's Components section lists the view's instances by owner, with native
disclosures for nested instances, counts, and a link from each instance to its
selection. Selecting an instance shows it in Selection with the contents that
the
[explorer contract](./mokly-component-explorer.md#components-in-the-screen-inspector)
states. Details and Usage stay available without crowding the selected
instance. Welcome has four instances: its own Action, the Toolbar, and the
Toolbar's two Actions. The nested Toolbar contents start collapsed and expand
in the nested selection, `design/canvas/inspect/selection/primary`. Each
instance of the component tree opens its own selection artboard, whose
Selection head links the instance's component to its variant set.

Highlight components is a native switch in the Frames filter. It toggles the
highlight without navigation. The enabled artboards draw the shell's highlight
mask and labels: the shell's scrim with a cutout and an outline over each
highlighted component, and the shell's label of each, which names its
component and its instance. The same consumer DOM is used with highlighting off
and on, and no mask sets ancestor opacity. Each frame uses its own mask, with a
unique SVG mask id.

Mask geometry is fixed to the synthetic artboard's layout and matches its
actual DOM bounds. The runtime owns geometry collection, selection, Escape
handling, and cleanup. Comparison artboards disable highlighting, as does
a Removed screen because it has no current preview to inspect.
An empty usage list says no registered components are used in this view;
unavailable inspection never claims a zero count. Welcome's Usage in
`design/canvas/inspect/sections` shows an explicit empty Used by list.

Disabled highlight controls explain whether there are no registered components,
inspection is unavailable, a comparison is selected, or the screen was removed.
Highlight chips have a small gap above an intact rounded outline, shared by
outer and nested regions.

## Storybook Stories

The Storybook stories designs depict a branch of their own, the stories
branch. There the catalogue also holds the Menu, a stories entry: the
component entry of a stories file. Under the
[Storybook stories contract](./mokly-storybook.md#the-entry-and-its-variants),
its first story, Collapsed, renders the Menu's own page, and Expanded and
Disabled are its variants. On the branch, Expanded opens its list through a
portal, so it could not render. The branch also adds Disabled, so Changes
lists two entries: Expanded, changed, and Disabled, added. No screen uses the
Menu, so Usage lists no consumers.

Each view of a story that could not render holds an error document in place
of the story. The document starts where the story would render, and its title
says that the story could not render: `The Expanded story couldn’t render`.
Next, it tells the reader to add the `!mokly` tag to leave the story out of
the catalogue. It gives the reason last, under `Reason`, here
`document is not defined`. The document carries only its own styles, with
system colours that follow the scheme of its view, so the Dark frame shows it
dark. Project CSS therefore cannot change its look or mark a failed view as
changed.

Around the document, the shell does not change. On
`design/canvas/stories/failed`, Expanded keeps its Changed badge and its
Changes tab. Props still edits the story's args, so a reader can try args that
render. The error document renders no registered component, and neither does
the Menu, so Highlight components is unavailable.

Changes shows a failed story as an ordinary changed variant. On Expanded's
Changes tab, `design/canvas/stories/failed/changes`, Side by side shows
Expanded's last render at the branch point, with the list open, as Before. It
shows the error document as Current. The comparison details say that the
rendered content changed, and they name the saved variant with its unchanged
saved props.

Details of a stories entry name the story that the page renders in a Story
row, directly below Source. On the Menu's own page,
`design/canvas/stories/storybook`, the row reads `Collapsed`. That page is
unmodified, but its set shows the changed Expanded row, so its panel has
Changes. When the
configuration gives the URL of the published Storybook, as on the stories
branch, a Storybook row follows the Story row. Its link, `Open in Storybook`,
opens the same story there in a new tab, so the reader keeps their place and
their prop edits. An external-link icon follows the text, and a screen-reader
label adds `(opens in a new tab)`.

The page of an added story has no Storybook row, because the published
Storybook does not hold that story yet. So
`design/canvas/stories/storybook/added`, the added Disabled from the Changes
filter, shows a Story row and no Storybook row. A changed story, such as
Expanded, keeps its link. In a build without Changes, and while Changes is
not ready, every story page shows its link.
