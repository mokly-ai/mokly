# Design Mockup Navigation Links

This page is part of the [design mockup links
contract](./mokly-design-links.md). That page owns the scope, the link
behavior, and the canonical destinations of every design link.
This page lists the destinations of the navigation controls and of the screen
variants.

## Navigation Controls

| Control/context                                 | Destination or behavior                                                                                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand, home breadcrumb, missing-route recovery  | `design/browse/views/home`                                                                                                                                                                                                               |
| Home: Open the first screen                     | `design/browse/views/screen`                                                                                                                                                                                                             |
| All catalogue: Welcome / Details / Example tour | `design/browse/views/screen` / `design/browse/views/details-screen` / `design/browse/views/use-case`                                                                                                                                     |
| Changed catalogue: Welcome / Details / Farewell | `design/changes/diff-controls/current` / `design/changes/outcomes/added` / `design/changes/outcomes/removed`                                                                                                                             |
| Changed catalogue: Survey / Invite / Archive    | `design/changes/outcomes/previous-version/long` / `design/changes/outcomes/previous-version/loading` / `design/changes/outcomes/previous-version/unavailable`                                                                            |
| Changed catalogue: Timeline                     | `design/changes/outcomes/previous-version/no-view`                                                                                                                                                                                       |
| Removed documents: four Changes rows            | `design/browse/pages/removed` / `design/browse/pages/previous-version/long` / `design/browse/pages/previous-version/loading` / `design/browse/pages/previous-version/unavailable`, each returning to `design/browse/views/home` from All |
| MiniWelcome: Open the details screen            | `design/browse/views/details-screen`                                                                                                                                                                                                     |
| MiniDetails: Return to welcome                  | `design/browse/views/screen`                                                                                                                                                                                                             |
| Depicted use-case step reference                | Welcome: `design/browse/views/screen`; Details: `design/browse/views/details-screen`                                                                                                                                                     |
| Welcome/Details inspector: Example tour         | `design/browse/views/use-case`                                                                                                                                                                                                           |
| Home menu open / drawer close                   | `design/browse/states/navigation` / `design/browse/views/home`                                                                                                                                                                           |
| Menu from another narrow design                 | Canonical `design/browse/states/navigation`; selecting a leaf opens that leaf's canonical destination                                                                                                                                    |
| Welcome All / Changes filter                    | `design/browse/views/screen` / `design/changes/diff-controls/current`                                                                                                                                                                    |
| Details All / Changes filter                    | `design/browse/views/details-screen` / `design/changes/outcomes/added`                                                                                                                                                                   |
| Removed screen All filter                       | `design/browse/views/home`, because the depicted product screen has no current entry                                                                                                                                                     |
| Empty Changes All filter                        | `design/changes/impact/ignored-only`                                                                                                                                                                                                     |
| Removed consumer return, component explorer     | `design/components/states/removed`, from the desktop Action row and the narrow Changes shortcut, never from the stage                                                                                                                    |

Folder rows and folder-only crumbs are not link targets: a folder row only
expands or collapses, and a folder crumb opens the folder's own page only when
one exists ([folder rules](./mokly-folders.md#rows-and-clicks)). The depicted
tree's groups are text or native disclosure markup. Its leaves link to
explicit paths. A depicted home crumb has a distinct label and the home
destination.

The home drawer depicts the canonical home state; closing it returns home. The
separately authored document drawer keeps its document as described below. An
icon-only close control needs an accessible label. Do not imply a preserved
origin screen or simulate closing a drawer by linking back to the open state.

Inspector data and links must describe the depicted subject. Each screen's
inspector shows its own subject's path, tags, and description, not Welcome's.
Removed screens have no live product target or live-use-case link; their
inspector names the previous version's base commit. Related-doc labels
without a portable public document stay plain text. A related doc that names
a document links to that document's design destination, as the product's
Related docs row does under the [documents contract](./mokly-documents.md).

The page designs have explicit document destinations.
`design/browse/pages/view` and `design/browse/pages/details` pair the
closed/open inspector; `design/browse/pages/navigation` opens the document's
drawer and closes back to its view. Its page row targets
`design/browse/pages/view`; Welcome and Example tour keep their design
destinations. The shared synthetic document takes an explicit Welcome
destination so its design variant stays inside the design catalogue, while the
real document links to `example/screens/welcome`. The removed-page state keeps a
flat row and returns to catalogue home without inventing parents.

`design/browse/publication/catalogue` omits filter and comparison controls.
`design/browse/publication/changes` offers the Welcome comparison
destinations; its Changes action opens `design/changes/diff-controls/current`.
Unsupported combinations stay depictions. None of these six states borrows
another subject's inspector or drawer identity.

## Screen Variants

The five variant states, `design/browse/variants/variant-selected`, `-changes`,
`-removed`, `-reparented`, and `design/browse/variants/changed-views`, depict a
screen's variants as ordinary catalogue entries grouped under their parent. The
disclosure beside a parent row is a depiction with no destination, because the
served shell toggles the list in place; the parent row itself keeps its own
destination. A variant row without an authored destination stays a depiction.

| Control/context                              | Destination                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| All catalogue: Welcome parent row            | `design/browse/views/screen`, the parent's own screen                         |
| All catalogue: `Empty workspace` variant row | `design/browse/variants/variant-selected`                                     |
| Selected variant: Welcome breadcrumb         | `design/browse/views/screen`, because a variant keeps its parent's crumbs     |
| Selected variant: Changes filter             | `design/browse/variants/variant-changes`                                      |
| Changed variant: All filter                  | `design/browse/variants/variant-selected`                                     |
| Changed variant: Welcome parent row          | `design/browse/variants/variant-changes`, the parent's first changed variant  |
| Removed variant: All filter                  | `design/browse/views/screen`, because the parent screen still exists          |
| Reparented removed variant: All filter       | `design/browse/views/home`, because its former parent is now a variant        |
| Changed views: All filter                    | `design/browse/views/screen`                                                  |
| Changed views: Details view list             | `design/changes/outcomes/changed`, the canonical comparison with both schemes |

The changed-variant and removed-variant states keep their Welcome breadcrumb as
text, because no artboard depicts an unmodified parent inside Changes. On the
removed state the parent row is a depiction too: the deletion is a later state
of the same group, so it must not open the earlier changed-variant scenario. The
removed variant has no live product destination and no comparison modes; its
stage shows the variant's inert previous version. In the reparented state, only
the removed child is a Changes row: it is a removed entry whose former parent
now names a variant. The Changes filter therefore hides the unmodified current
parent and its variant (the former parent), and shows the removed child as one
flat screen row outside their former folder hierarchy. The historical breadcrumb
stays visible on the screen itself with the former parent's title as plain text,
but the Changes rail contains no parent or nested variant list. The depicted All
control links to the canonical catalogue home artboard; the reparented hierarchy
is the context for this Changes-state example. The changed-views state shows no
comparison band. Its marks on Appearance and the viewport dropdown identify
evidence about other views. The Details view list opens the canonical
comparison; the outer Appearance control chooses its rendered scheme. The
depicted Appearance selector has no authored transition.

## Related Docs

- [Design mockup links](./mokly-design-links.md)
- [Design mockup comparison and tag links](./mokly-design-links-comparisons.md)
