# Canvas Design Inventory

This continues the [shell design inventory](./mokly-shell-design-inventory.md).
It lists the `design/canvas` screens, which depict the Canvas viewer: the
[canvas stage](./mokly-shell-canvas-stage.md), the floating panels, Inspect,
Changes and the [compact layout](./mokly-shell-device-chrome.md#compact-layout).

## Inventory

The screens are authored in `examples/basic/specs/design/canvas/` and rendered
as each entry's path-derived `index.<viewport>.html` views under the
[artifact path contract](./mokly-artifact-paths.md). The Entry column names
each screen by its complete path under the [path contract](./mokly-paths.md).
The Folder column is the resolved titles of its folders below the `Design`
folder. The family holds seventeen screens and twelve variants.

| Entry                                                 | Folder                                    | State                                                    |
| ----------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `design/canvas/overview`                              | Canvas viewer                             | Welcome as four frames, Inspect open, nothing selected   |
| `design/canvas/stage/zoomed`                          | Canvas viewer › Canvas stage              | Welcome at 100%, panned onto Desktop · Light             |
| `design/canvas/stage/component-set`                   | Canvas viewer › Canvas stage              | The Action opened as its variant set                     |
| `design/canvas/stage/component-set/disabled`          | Canvas viewer › Canvas stage (variant)    | Disabled chosen: its Light frame selected for Props      |
| `design/canvas/stage/component-set/toolbar`           | Canvas viewer › Canvas stage (variant)    | The Toolbar's variant set with its nested components     |
| `design/canvas/stage/component-set/toolbar-primary`   | Canvas viewer › Canvas stage (variant)    | The Toolbar's first Action selected on Default · Light   |
| `design/canvas/stage/component-set/toolbar-secondary` | Canvas viewer › Canvas stage (variant)    | The Toolbar's second Action selected on Default · Light  |
| `design/canvas/stage/document`                        | Canvas viewer › Canvas stage              | Payment terms as one reading frame                       |
| `design/canvas/stage/catalogue`                       | Canvas viewer › Canvas stage              | The catalogue in Changes, naming its base                |
| `design/canvas/stage/home`                            | Canvas viewer › Canvas stage              | Home guidance on the canvas, no right panel              |
| `design/canvas/inspect/unchanged`                     | Canvas viewer › Inspect                   | Light-only Profile with the Inspect tab alone            |
| `design/canvas/inspect/selection`                     | Canvas viewer › Inspect                   | Welcome's View details Action selected on Mobile · Light |
| `design/canvas/inspect/selection/toolbar`             | Canvas viewer › Inspect (variant)         | Welcome's Toolbar selected, padded on four sides         |
| `design/canvas/inspect/selection/primary`             | Canvas viewer › Inspect (variant)         | The Toolbar's first Action selected                      |
| `design/canvas/inspect/selection/secondary`           | Canvas viewer › Inspect (variant)         | The Toolbar's second Action selected                     |
| `design/canvas/inspect/sections`                      | Canvas viewer › Inspect                   | Usage and Components unfolded                            |
| `design/canvas/inspect/props`                         | Canvas viewer › Inspect                   | Props unfolded with Welcome's one prop                   |
| `design/canvas/inspect/frames`                        | Canvas viewer › Inspect                   | Frames filter with Dark off and the highlight on         |
| `design/canvas/changes/current`                       | Canvas viewer › Changes                   | Welcome's Changes tab in Current                         |
| `design/canvas/changes/side-by-side`                  | Canvas viewer › Changes                   | Side by side on Desktop · Light                          |
| `design/canvas/changes/overlay`                       | Canvas viewer › Changes                   | Overlay on every frame                                   |
| `design/canvas/changes/difference`                    | Canvas viewer › Changes                   | Difference on every frame                                |
| `design/canvas/changes/swipe`                         | Canvas viewer › Changes                   | Swipe's divider on every frame                           |
| `design/canvas/outcomes/added`                        | Canvas viewer › Change outcomes           | Added Details in Inspect, with both tabs                 |
| `design/canvas/outcomes/added/changes`                | Canvas viewer › Change outcomes (variant) | Added Details' Changes tab, with Current alone           |
| `design/canvas/outcomes/added/welcome`                | Canvas viewer › Change outcomes (variant) | Details' own Action selected from its component tree     |
| `design/canvas/outcomes/added/toolbar`                | Canvas viewer › Change outcomes (variant) | Details' Toolbar selected                                |
| `design/canvas/outcomes/added/primary`                | Canvas viewer › Change outcomes (variant) | The first Action of Details' Toolbar selected            |
| `design/canvas/outcomes/added/secondary`              | Canvas viewer › Change outcomes (variant) | The second Action of Details' Toolbar selected           |

The entries marked as variants stay under their parent screen in authored
order rather than becoming folder members. `design/canvas/overview` is the
family's canonical screen, and each folder holds at most five screens.

## Family Rules

- Every Canvas screen renders in both schemes and in both viewports. The outer
  Appearance control moves between the two renders of an entry. In both
  renders, each frame on the canvas shows its own scheme's view, and the
  reading frame of `design/canvas/stage/document` follows the rendered
  appearance.
- Every Canvas artboard draws the top bar with its one Appearance selector,
  which names the scheme that its file was rendered for.
- A desktop render draws the floating catalogue, the right panel of a selected
  entry and the zoom pill, and turns compact below the shell's breakpoint. A
  mobile render draws the compact layout at every width: the entry bar with
  the frame picker, the dock, and only the sheet that its state opens.
- In the mobile render, `design/canvas/stage/home` and
  `design/canvas/stage/catalogue` open the catalogue sheet.
  `design/canvas/inspect/unchanged`, `design/canvas/inspect/props`,
  `design/canvas/inspect/sections`, `design/canvas/stage/component-set/disabled`,
  `design/canvas/changes/current` and `design/canvas/outcomes/added/changes`
  open the panel sheet, and `design/canvas/inspect/sections` expands it.
- The Canvas screens browse the canonical branch of the
  [depicted catalogue](./mokly-shell-design-catalogue.md#canvas-states), whose
  Canvas links stay inside the family.
- The Canvas screens draw the
  [Canvas viewer parts](./mokly-design-component-library-canvas.md) of the
  design library, in the Canvas palette of `@mokly/ui`.
- Catalogue navigation alone reaches `design/canvas/inspect/frames` and
  `design/canvas/inspect/props`; no artboard links to them.

## Related Docs

- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
- [Shell design contract](./mokly-shell-design.md)
- [Shell canvas stage](./mokly-shell-canvas-stage.md)
- [Design mockup links](./mokly-design-links.md)
