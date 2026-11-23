# Shell Design Inventory

## Inventory

The design screens are authored in `examples/basic/specs/design/` and
rendered as each entry's path-derived `index.<viewport>.html` views under the
[artifact path contract](./mokly-artifact-paths.md). The design catalogue
keeps one Canvas family of Browse designs, under the
[shell design contract](./mokly-shell-design.md#design-mockups). The
[Canvas design inventory](./mokly-shell-canvas-inventory.md), the
[loading, search and evidence inventory](./mokly-shell-canvas-inventory-states.md)
and the [component design inventory](./mokly-component-design-inventory.md)
list that family. Together the pages define the complete set of Mokly shell
design screens and match the example's catalogue index. A destination
without a standalone screen stays in its feature contract.

## Schemes And Views

Every Canvas screen renders in both schemes, under the Canvas
[family rules](./mokly-shell-canvas-inventory.md#family-rules). The outer
viewer shows both renders of an entry under the
[preview scheme rules](./mokly-shell-device-chrome.md#color-scheme).

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

Retry in `design/canvas/outcomes/removed/unavailable` and in
`design/canvas/outcomes/removed-document/unavailable` is a picture of
itself. It requests the same entry's previous version again, and no artboard
shows Archive or Style notes while their previous version loads again.

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
