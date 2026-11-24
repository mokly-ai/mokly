# Component Design Inventory

This continues the [component explorer design](./mokly-component-design.md).
It lists the Component explorer and Props and controls folders of the
[Canvas design inventory](./mokly-shell-canvas-inventory.md). The columns of
the [Canvas inventory](./mokly-shell-canvas-inventory.md#inventory) and its
[family rules](./mokly-shell-canvas-inventory.md#family-rules) apply to every
entry here.

## Owning Catalogue

Source lives under `examples/basic/specs/design/canvas/components/` and
`examples/basic/specs/design/canvas/props/`. Mokly renders each artboard as
its path-derived `index.<viewport>.html` views under the
[artifact path contract](./mokly-artifact-paths.md). Each folder holds five
screens, and their saved variants stay under them in authored order.

| Entry                                               | Folder                       | State                                                              | Phone sheet       |
| --------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ | ----------------- |
| `design/canvas/components/compare`                  | Component explorer           | The changed Default in Overlay on every frame of its variant set   | None              |
| `design/canvas/components/compare/current`          | Component explorer (variant) | Default's Changes tab in Current                                   | Changes           |
| `design/canvas/components/compare/side-by-side`     | Component explorer (variant) | Default · Light's two versions side by side, a chip for each frame | None              |
| `design/canvas/components/compare/difference`       | Component explorer (variant) | Difference on every frame of the set                               | None              |
| `design/canvas/components/compare/props`            | Component explorer (variant) | Inspect while Overlay stays chosen: current frames, editable Props | Inspect           |
| `design/canvas/components/usage`                    | Component explorer           | Default in Current: Used by and the affected screens               | Inspect, expanded |
| `design/canvas/components/usage/loading`            | Component explorer (variant) | The parent's detail loads: the stage, Props and Usage wait         | Inspect           |
| `design/canvas/components/usage/failed`             | Component explorer (variant) | The parent's detail failed: the stage, Props and Usage say so      | Inspect           |
| `design/canvas/components/affected`                 | Component explorer           | Unmodified Welcome, which the Action affects, in Side by side      | None              |
| `design/canvas/components/affected/details`         | Component explorer (variant) | The same for Details                                               | None              |
| `design/canvas/components/affected/direct`          | Component explorer (variant) | Welcome's own prop change beside the Action, with paired props     | Changes           |
| `design/canvas/components/inspection`               | Component explorer           | Details while the usage of its view is pending                     | Inspect, expanded |
| `design/canvas/components/inspection/unavailable`   | Component explorer (variant) | Details without inspection metadata                                | Inspect, expanded |
| `design/canvas/components/removed`                  | Component explorer           | The removed Compact on its parent's set, with no current version   | None              |
| `design/canvas/components/removed/changes`          | Component explorer (variant) | Compact's version before beside its missing current version        | None              |
| `design/canvas/components/removed/consumer`         | Component explorer (variant) | Farewell, a removed former consumer, in its Removed state          | None              |
| `design/canvas/components/removed/consumer-changes` | Component explorer (variant) | Farewell's Changes tab, the first of the branch's two changes      | Changes           |
| `design/canvas/props/editing`                       | Props and controls           | Default chosen: Props edits each control type, Reset off           | Inspect           |
| `design/canvas/props/editing/edited`                | Props and controls (variant) | Label, Corner radius and Emphasis edited on both Default frames    | Inspect           |
| `design/canvas/props/editing/unset`                 | Props and controls (variant) | The optional Hint unset, which differs from an empty hint          | Inspect           |
| `design/canvas/props/editing/reset`                 | Props and controls (variant) | Default's saved props restored, Reset off again                    | Inspect           |
| `design/canvas/props/states`                        | Props and controls           | `Updating preview`: each frame keeps its last valid preview        | Inspect           |
| `design/canvas/props/states/invalid`                | Props and controls (variant) | Corner radius 40 rejected, with its field error                    | Inspect           |
| `design/canvas/props/states/invalid-together`       | Props and controls (variant) | Values not valid together: no field marked, Reset the one way back | Inspect           |
| `design/canvas/props/states/error`                  | Props and controls (variant) | The render failed: the edits stay, with Try again                  | Inspect           |
| `design/canvas/props/states/expired`                | Props and controls (variant) | The temporary preview expired: the edits stay, with Update preview | Inspect           |
| `design/canvas/props/preparing`                     | Props and controls           | Read-only fields under `Preparing to edit props…`                  | Inspect           |
| `design/canvas/props/preparing/failed`              | Props and controls (variant) | `Editing could not start.`, with Try again                         | Inspect           |
| `design/canvas/props/read-only`                     | Props and controls           | A static build: Default's saved props read-only                    | Inspect           |
| `design/canvas/props/read-only/disabled`            | Props and controls (variant) | A static build with Disabled chosen, read-only                     | Inspect           |
| `design/canvas/props/read-only/no-props`            | Props and controls (variant) | Details, a screen without props, with Props unfolded               | Inspect           |
| `design/canvas/props/loading`                       | Props and controls           | `Loading props…` and no fields while the route's details load      | Inspect           |
| `design/canvas/props/loading/failed`                | Props and controls (variant) | The route's details failed: the stage, Props and Usage say so      | Inspect           |

## Component Explorer

- The compare, usage and affected states depict the Action branch of the
  [depicted catalogue](./mokly-shell-design-catalogue.md#depicted-branches).
  `design/canvas/components/affected/direct` depicts the direct-change branch,
  and `design/canvas/components/removed` and its variants depict the removal
  branch. Screen inspection depicts Details on the canonical branch.
- A saved variant opens its parent's variant set with its Light frame
  selected. A changed component compares on its variant set row by row, and a
  row that does not compare keeps its current frames. On the Action branch
  every row changed, so every frame of the set compares, its own example's
  frames included. Each compared frame holds both versions of its view at one
  size, the larger width and the larger height of the two. On the Action
  branch, no version before is larger than its current version, so each frame
  keeps the size of its current version. In Side by side, a chip names each
  frame of a compared row as the frame's label does, the own example's frames
  first.
- The changed Default's compare modes link Current to
  `design/canvas/components/compare/current`, Side by side to
  `design/canvas/components/compare/side-by-side`, Overlay to
  `design/canvas/components/compare` and Difference to
  `design/canvas/components/compare/difference`. Swipe is a picture of
  itself, because no artboard shows the set in Swipe.
- An affected screen keeps no Changes row of its own, so its Changes tab has
  no stepper. A screen that also changes the props that it supplies keeps its
  own Changes row, and its comparison details pair those props in each view.
- A removed saved variant stays on its parent's set after the current
  variants. Each of its frames says that it has no current version, and Props
  keeps its saved props read-only. Its comparison falls back to Side by side.
- Compact's affected list keeps Farewell, a removed former consumer. Its row
  reads `Farewell · Removed` and opens
  `design/canvas/components/removed/consumer`, which shows Farewell's
  previous version under the
  [removed previews](./mokly-removed-previews.md#behavior) rules. Farewell's
  Changes tab, `design/canvas/components/removed/consumer-changes`, is the
  first of the branch's two changes, and its Next change opens Compact's
  comparison.

## Props And Controls

The [component controls design](./mokly-component-controls-design.md#owning-catalogue)
owns the states of Inspect's Props section. Each Props state shows a saved
variant of the Action on its variant set, except
`design/canvas/props/read-only/no-props`, which shows Details.
