# Design Mockup Navigation Links

This page is part of the [design mockup links
contract](./mokly-design-links.md). That page owns the scope, the link
behavior, and the canonical destinations of every design link.
This page lists the destinations of the navigation controls and of the screen
variants.

## Navigation Controls

Canvas links stay inside the Canvas family: a control opens the Canvas
artboard that shows its outcome, and a control without one is a depiction.
The Browse, Changes and component explorer screens outside the family link to
Canvas artboards too, except their links to the use case and to the previous
versions of removed entries.

| Control/context                                                                     | Destination or behavior                                                                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand, catalogue home crumb, missing-route recovery                                 | `design/canvas/stage/home`                                                                                                                                            |
| Home: Open the first screen                                                         | `design/canvas/overview`                                                                                                                                              |
| All catalogue: Welcome / Details / Profile                                          | `design/canvas/overview` / `design/canvas/outcomes/added` / `design/canvas/inspect/unchanged`                                                                         |
| All catalogue: Action / Toolbar / Payment terms                                     | `design/canvas/stage/component-set` / `design/canvas/stage/component-set/toolbar` / `design/canvas/stage/document`                                                    |
| Changed catalogue on Inspect: Welcome / Details / Invoice / Payment terms           | `design/canvas/stage/catalogue` / `design/canvas/outcomes/added` / `design/canvas/outcomes/moved/inspect` / `design/canvas/stage/document`                            |
| Changed catalogue on Changes: Welcome / Details / Invoice                           | `design/canvas/changes/current` / `design/canvas/outcomes/added/changes` / `design/canvas/outcomes/moved`                                                             |
| Welcome Changes filter / catalogue All filter                                       | `design/canvas/stage/catalogue` / `design/canvas/overview`                                                                                                            |
| Menu or dock Catalogue / catalogue sheet close                                      | `design/canvas/stage/catalogue` / `design/canvas/overview`                                                                                                            |
| Right panel: Inspect / Changes tab                                                  | The artboard of the same entry on that tab, such as `design/canvas/overview` / `design/canvas/changes/current` for Welcome                                            |
| Zoom pill: Zoom in / Fit                                                            | `design/canvas/stage/zoomed` from Welcome / the fitted artboard of the same state: the artboard itself, or `design/canvas/overview` from `design/canvas/stage/zoomed` |
| Component tree, highlight label                                                     | The artboard that selects that instance, such as `design/canvas/inspect/selection`                                                                                    |
| Dock's current tab, selection pill                                                  | The artboard with the panel sheet open, such as `design/canvas/inspect/sections` from `design/canvas/inspect/selection`                                               |
| Selection head, Used by row                                                         | The artboard of that component or consumer, such as `design/canvas/stage/component-set`                                                                               |
| MiniWelcome / MiniDetails                                                           | Open the details screen: `design/canvas/outcomes/added`; Return to welcome: `design/canvas/overview`                                                                  |
| Depicted use-case step reference                                                    | Welcome: `design/canvas/overview`; Details: `design/canvas/outcomes/added`                                                                                            |
| Example tour, outside the Canvas family                                             | `design/browse/views/use-case`                                                                                                                                        |
| Removed screens outside the family: Farewell / Survey / Invite / Archive / Timeline | `design/changes/outcomes/removed` / `design/changes/outcomes/previous-version/long` / `…/loading` / `…/unavailable` / `…/no-view`                                     |
| Removed documents: four Changes rows                                                | `design/browse/pages/removed` / `design/browse/pages/previous-version/long` / `…/loading` / `…/unavailable`, each returning to `design/canvas/stage/home` from All    |
| Removed consumer return, component explorer                                         | `design/components/states/removed`, from the desktop Action row and the narrow Changes shortcut, never from the stage                                                 |

A catalogue row keeps the right panel's tab where its entry has an artboard on
that tab, and the selected row opens the artboard that draws it. In the Canvas
catalogue, the Example tour row and the removed rows are depictions, because
no Canvas artboard shows them. The Changes list of a removed entry outside the
family opens Welcome and Details on their Changes tabs. The All filter of the
`design/changes/outcomes` and `design/browse/pages` screens opens
`design/canvas/stage/home`, because their removed entry is not in All. The All
filter of the removed variant, the appearance screens and the tag picker opens
`design/canvas/overview`.

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
depiction: no artboard shows a Welcome variant, so Welcome's variant rows are
depictions.

The Variants section of a component's Inspect opens the artboard that chooses
each variant on the same branch: from `design/canvas/stage/component-set`,
Default opens `design/canvas/props/editing` and Disabled opens
`design/canvas/stage/component-set/disabled`. A variant without such an
artboard is a depiction.

`design/browse/variants/variant-removed` depicts a removed variant under its
surviving parent. Its All filter opens `design/canvas/overview`, because the
parent screen still exists. Its Welcome breadcrumb stays text, and its parent
row is a depiction: the deletion is a later state of the same group, so it
must not open another scenario. The removed variant has no live product
destination and no comparison modes; its stage shows the variant's inert
previous version.

## Related Docs

- [Design mockup links](./mokly-design-links.md)
- [Design mockup comparison and tag links](./mokly-design-links-comparisons.md)
