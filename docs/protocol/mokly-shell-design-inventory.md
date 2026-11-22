# Shell Design Inventory

## Inventory

The design screens are authored in `examples/basic/specs/design/` and
rendered as each entry's path-derived `index.<viewport>.html` views under the
[artifact path contract](./mokly-artifact-paths.md). The design catalogue
keeps one Canvas family of Browse designs, under the
[shell design contract](./mokly-shell-design.md#design-mockups). The
[Canvas design inventory](./mokly-shell-canvas-inventory.md) and its two
linked pages list that family. The table below lists the older Browse and
Changes screens that the catalogue keeps, and the
[component design inventory](./mokly-component-design-inventory.md#kept-explorer-screens)
lists the two kept component explorer screens. Together the pages define the
complete set of Mokly shell design screens and match the example's catalogue
index.

The Entry column names each screen by its complete path under the
[path contract](./mokly-paths.md). The Folder column is the resolved titles
of its folders below the `Design` folder. A destination without a standalone
screen stays in its feature contract.

| Entry                                                  | Folder                                                     | State                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `design/browse/views/use-case`                         | Browse shell › Catalogue views                             | Selected use case with ordered steps                          |
| `design/browse/views/screen/tag-picker`                | Browse shell › Catalogue views › Screen                    | Welcome with an empty query and the tag picker open           |
| `design/browse/variants/variant-removed`               | Browse shell › Screen variants                             | Removed variant under a surviving parent                      |
| `design/browse/pages/removed`                          | Browse shell › Document pages                              | Removed document's previous version with its base commit      |
| `design/browse/pages/previous-version/long`            | Browse shell › Document pages › Previous document versions | A long previous document scrolling inside its pane            |
| `design/browse/pages/previous-version/loading`         | Browse shell › Document pages › Previous document versions | Waiting for a removed document's previous version             |
| `design/browse/pages/previous-version/unavailable`     | Browse shell › Document pages › Previous document versions | Previous document unavailable, with Retry                     |
| `design/browse/appearance/states/light-only-document`  | Browse shell › Appearance › Appearance states              | A removed document with no dark render keeping its light page |
| `design/browse/appearance/status/flow`                 | Browse shell › Appearance › Status and recovery            | Use-case steps around light screens                           |
| `design/changes/outcomes/removed`                      | Changes › Comparison outcomes                              | Removed badge and previous version without comparisons        |
| `design/changes/outcomes/previous-version/long`        | Changes › Comparison outcomes › Previous screen versions   | A tall previous screen scrolling inside its device frame      |
| `design/changes/outcomes/previous-version/loading`     | Changes › Comparison outcomes › Previous screen versions   | Waiting for a removed screen's previous views                 |
| `design/changes/outcomes/previous-version/unavailable` | Changes › Comparison outcomes › Previous screen versions   | Previous views unavailable, with Retry                        |
| `design/changes/outcomes/previous-version/no-view`     | Changes › Comparison outcomes › Previous screen versions   | A viewport with no captured previous view                     |

## Kept Screens

The kept screens draw the shipped shell, not the Canvas viewer. All but one
depict a state that the Canvas family does not draw:

- A use case: `design/browse/views/use-case` and
  `design/browse/appearance/status/flow`. Decision 33, on how a use case
  stands on the canvas, is open.
- A removed entry's previous version: the removed screens, documents and
  variant, the light-only removed document, and the two kept component
  explorer screens. Decision 34, on how that version stands on the canvas, is
  open.
- `design/browse/views/screen/tag-picker` draws the shipped tag picker over
  Welcome. The design library's runtime test opens it until the viewer's race
  on a third nested disclosure is fixed. Its Canvas form is
  `design/canvas/search/tags`.

The owning groups keep each folder at no more than five screens:

- `design/browse/views/use-case`, `design/browse/pages/removed` and
  `design/changes/outcomes/removed` are the canonical screens of Catalogue
  views, Document pages and Comparison outcomes. The use case renders the
  ordered steps of existing screens. A removed document keeps its flat
  Changes row and the ancestry of its deleted parent.
- The `Previous document versions` and `Previous screen versions` folders hold
  the removed-preview child pages (loading, unavailable with retry,
  long-document scrolling, and, for screens, a viewport with no captured
  previous view) specified by [removed previews](./mokly-removed-previews.md).
  Each parent removed page renders its canonical preview and links to those
  children. The removed documents depict a branch that removed four
  documents, and the removed screens depict the canonical branch, which
  removed five screens. Each child is a sibling removed entry in the same flat
  Changes list and is selected the way a reader selects it. A parent's
  document pane or device frames hold its previous version under the "Showing
  previous version" label; a child's loading or unavailable stage replaces
  that label and those frames while the catalogue navigation, Removed badge,
  breadcrumbs, and Details stay in place. Retry repeats the request, so it
  returns to the loaded preview. The no-captured-view child keeps the label
  and the viewport control, replacing only the selected viewport's frame with
  the stage note that [removed previews](./mokly-removed-previews.md) fixes.
  Served and built previews are identical, so no static-delivery variant is
  designed.
- `design/browse/variants/variant-removed` specifies a deleted variant
  retained as a Removed row under its surviving parent. Its behavior contract
  is [variants](./mokly-variants.md).
- The `Appearance` folder has no screen of its own. Its `Appearance states`
  folder holds the light-only removed document, and `Status and recovery`
  holds the use-case flow, under the
  [viewer appearance mockups](./mokly-viewer-appearance-mockups.md).

## Schemes And Views

Every Canvas screen renders in both schemes, under the Canvas
[family rules](./mokly-shell-canvas-inventory.md#family-rules). Of the kept
screens, the two appearance screens render in both schemes, and the other
fourteen are light-only documents. The outer viewer shows both renders of an
entry under the [preview scheme rules](./mokly-shell-device-chrome.md#color-scheme).

Every artboard that draws a top bar draws exactly one scheme control in it,
the depicted Appearance selector, because the standalone shell always offers
that setting. The selector names the scheme its file was rendered for.

Every screen renders one mobile and one desktop view. Mockup implementation
notes live in entry descriptions, rationale, and related docs — never inside
the rendered screen area.

Navigation inside these design artboards uses native `MockLink` anchors. The
[design mockup links contract](./mokly-design-links.md) defines canonical
destinations and the boundary between linked states and local runtime
controls. Those links are mockup navigation, separate from the outer shell
that the [shell design contract](./mokly-shell-design.md) describes.

## Loading State Retries

Runtime transitions reach some Canvas states that no depicted control opens:
the startup and entry states of `design/canvas/loading`, the loading states
of Props and Usage and the preparation state of Props, each with its failed
variant, the pending screen inspection `design/canvas/components/inspection`,
and three Props states, `design/canvas/props/read-only/no-props`,
`design/canvas/props/states/expired` and
`design/canvas/props/states/invalid-together`. Catalogue navigation reaches
each of them. An artboard links to one only as a failure state's retry:

- Try again in `design/canvas/loading/catalogue/failed` and Reload in
  `design/canvas/loading/catalogue/version` open
  `design/canvas/loading/catalogue`.
- Try again in `design/canvas/loading/entry/failed` opens
  `design/canvas/loading/entry`.
- Try again in `design/canvas/props/preparing/failed` opens
  `design/canvas/props/preparing`.
- Try again in `design/canvas/props/loading/failed` opens
  `design/canvas/props/loading`.
- Try again in `design/canvas/components/usage/failed` opens
  `design/canvas/components/usage/loading`.

## Depicted Catalogue

The fixture catalogue these screens browse, the branches they depict, and their
transitions live in the [depicted design catalogue](./mokly-shell-design-catalogue.md).

## Related Docs

- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Canvas loading, search and evidence inventory](./mokly-shell-canvas-inventory-states.md)
- [Component design inventory](./mokly-component-design-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
- [Shell design contract](./mokly-shell-design.md)
- [Design mockup links](./mokly-design-links.md)
- [Removed previews](./mokly-removed-previews.md)
- [Viewer appearance mockups](./mokly-viewer-appearance-mockups.md)
