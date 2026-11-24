# Design Mockup Navigation Links

This page is part of the [design mockup links
contract](./mokly-design-links.md). That page owns the scope, the link
behavior, and the canonical destinations of every design link.
This page lists the destinations of the navigation controls and of the screen
variants.

## Navigation Controls

Canvas links stay inside the Canvas family: a control opens the Canvas
artboard that shows its outcome, and a control without one is a depiction.

| Control/context                                                               | Destination or behavior                                                                                                                                               |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand, missing-route recovery                                                 | `design/canvas/stage/home`                                                                                                                                            |
| Home: Open the first screen                                                   | `design/canvas/overview`                                                                                                                                              |
| All catalogue: Welcome / Details / Profile                                    | `design/canvas/overview` / `design/canvas/outcomes/added` / `design/canvas/inspect/unchanged`                                                                         |
| All catalogue: Action / Toolbar / Payment terms / Example tour                | `design/canvas/stage/component-set` / `design/canvas/stage/component-set/toolbar` / `design/canvas/stage/document` / `design/canvas/flows/tour`                       |
| Changed catalogue on Inspect: Welcome / Details / Invoice / Payment terms     | `design/canvas/stage/catalogue` / `design/canvas/outcomes/added` / `design/canvas/outcomes/moved/inspect` / `design/canvas/stage/document`                            |
| Changed catalogue on Changes: Welcome / Details / Invoice                     | `design/canvas/changes/current` / `design/canvas/outcomes/added/changes` / `design/canvas/outcomes/moved`                                                             |
| Changed catalogue: Example tour, on Changes / on Inspect                      | `design/canvas/flows/tour/changes` / `design/canvas/flows/tour`                                                                                                       |
| Changed catalogue: Farewell, on Changes / on Inspect                          | `design/canvas/outcomes/removed` / `design/canvas/outcomes/removed/inspect`                                                                                           |
| Changed catalogue: Survey / Invite / Archive / Timeline                       | `design/canvas/outcomes/removed/long` / `…/loading` / `…/unavailable` / `…/no-view`                                                                                   |
| Welcome Changes filter / catalogue All filter                                 | `design/canvas/stage/catalogue` / `design/canvas/overview`                                                                                                            |
| Dock Catalogue / catalogue sheet close                                        | `design/canvas/stage/catalogue` / `design/canvas/overview`                                                                                                            |
| Right panel: Inspect / Changes tab                                            | The artboard of the same entry on that tab, such as `design/canvas/overview` / `design/canvas/changes/current` for Welcome                                            |
| Zoom pill: Zoom in / Fit                                                      | `design/canvas/stage/zoomed` from Welcome / the fitted artboard of the same state: the artboard itself, or `design/canvas/overview` from `design/canvas/stage/zoomed` |
| Component tree, highlight label                                               | The artboard that selects that instance, such as `design/canvas/inspect/selection`                                                                                    |
| Dock's current tab, selection pill                                            | The artboard with the panel sheet open, such as `design/canvas/inspect/sections` from `design/canvas/inspect/selection`                                               |
| Selection head, Used by row                                                   | The artboard of that component or consumer, such as `design/canvas/stage/component-set`                                                                               |
| A screen's Used by chip of the Example tour                                   | `design/canvas/flows/tour`                                                                                                                                            |
| MiniWelcome / MiniDetails                                                     | Open the details screen: `design/canvas/outcomes/added`; Return to welcome: `design/canvas/overview`                                                                  |
| Use-case step title                                                           | Welcome: `design/canvas/overview`; Details: `design/canvas/outcomes/added`                                                                                            |
| Handbook removal: Getting started / Field guide / Printing tips / Style notes | `design/canvas/outcomes/removed-document` / `…/long` / `…/loading` / `…/unavailable`                                                                                  |
| Removal branch: Farewell in Compact's affected list, or its row on Inspect    | `design/canvas/components/removed/consumer`                                                                                                                           |
| Removal branch: Farewell's row on Changes, or Compact's Previous change       | `design/canvas/components/removed/consumer-changes`                                                                                                                   |

A catalogue row keeps the right panel's tab where its entry has an artboard on
that tab, and the selected row opens the artboard that draws it. The All
filter of a removed screen of the canonical branch opens
`design/canvas/stage/home`, because the removed entry is not in All. The
handbook removal, the light-only removal and the variant removal are branches
of their own, so their All filter is a depiction.

Folder rows and folder-only crumbs are not link targets: a folder row only
expands or collapses, and a folder crumb opens the folder's own page only when
one exists ([folder rules](./mokly-folders.md#rows-and-clicks)). The depicted
tree's groups are text or native disclosure markup. Its leaves link to
explicit paths or stay depictions. A depicted home crumb has a distinct label
and the home destination.

A sheet's close control opens the artboard that shows the canvas without that
sheet, and stays a depiction where no artboard shows it. An icon-only close
control needs an accessible label. Do not imply a preserved origin screen or
simulate closing a sheet by linking back to the open state.

Inspect data and links must describe the depicted subject. Each entry's
Inspect shows its own subject's path, tags, and description, not Welcome's.
Removed screens have no live product target or live-use-case link; their
inspector names the previous version's base commit. Related-doc labels
without a portable public document stay plain text. A related doc that names
a document links to that document's design destination, as the product's
Related docs row does under the [documents contract](./mokly-documents.md).

## Screen Variants

A screen's variants are ordinary catalogue entries grouped under their parent.
The disclosure beside a parent row is a depiction with no destination, because
the served shell toggles the list in place; the parent row itself keeps its
own destination. A variant row without an authored destination stays a
depiction: no artboard of the canonical branch shows a Welcome variant, so
Welcome's variant rows are depictions there.

The Variants section of a component's Inspect opens the artboard that chooses
each variant on the same branch: from `design/canvas/stage/component-set`,
Default opens `design/canvas/props/editing` and Disabled opens
`design/canvas/stage/component-set/disabled`. A variant without such an
artboard is a depiction.

`design/canvas/outcomes/removed-variant` depicts a removed variant, Welcome's
`Save failed`, under its surviving parent, on a branch of its own. Its parent
row is a depiction: the deletion is a later state of the same group, so it
must not open another scenario. Its All filter is a depiction too, because no
artboard shows that branch in All. Its Inspect lists
`Save failed · Removed` after Welcome's current variants, whose rows are
depictions. The removed variant has no live product destination and no
compare mode; its canvas shows the variant's inert previous version, and its
two tabs open each other.

## Related Docs

- [Design mockup links](./mokly-design-links.md)
- [Design mockup comparison and tag links](./mokly-design-links-comparisons.md)
