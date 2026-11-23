# Canvas Design Inventory

This page is part of the [shell design inventory](./mokly-shell-design-inventory.md).
It lists the `design/canvas` family, which depicts the Canvas viewer: the
[canvas stage](./mokly-shell-canvas-stage.md), the floating panels, Inspect,
Changes and the [compact layout](./mokly-shell-device-chrome.md#compact-layout).
This page lists six of the family's eleven folders. The
[loading, search and evidence inventory](./mokly-shell-canvas-inventory-states.md)
lists three, and the
[component design inventory](./mokly-component-design-inventory.md) lists the
Component explorer and Props and controls folders. The family rules below
apply to every entry of the three pages.

## Inventory

The screens are authored in `examples/basic/specs/design/canvas/` and rendered
as each entry's path-derived `index.<viewport>.html` views under the
[artifact path contract](./mokly-artifact-paths.md). The Entry column names
each entry by its complete path under the [path contract](./mokly-paths.md).
The Folder column is the resolved title of the entry's folder: the
`Canvas viewer` folder below the `Design` folder, or one of its child folders.
The Phone sheet column names the sheet that the mobile render opens: the
catalogue sheet, the panel sheet at its Inspect or Changes tab, or the tag
picker's sheet. None means that no sheet opens. A panel sheet opens at its
compact height unless the column says expanded.

| Entry                                                 | Folder                    | State                                                     | Phone sheet       |
| ----------------------------------------------------- | ------------------------- | --------------------------------------------------------- | ----------------- |
| `design/canvas/overview`                              | Canvas viewer             | Welcome as four frames, Inspect open, nothing selected    | None              |
| `design/canvas/stage/zoomed`                          | Canvas stage              | Welcome at 100%, panned onto Desktop · Light              | None              |
| `design/canvas/stage/component-set`                   | Canvas stage              | The Action opened as its variant set                      | None              |
| `design/canvas/stage/component-set/disabled`          | Canvas stage (variant)    | Disabled chosen: its Light frame selected for Props       | Inspect           |
| `design/canvas/stage/component-set/toolbar`           | Canvas stage (variant)    | The Toolbar's variant set with its nested components      | None              |
| `design/canvas/stage/component-set/toolbar-primary`   | Canvas stage (variant)    | The Toolbar's first Action selected on Toolbar · Light    | None              |
| `design/canvas/stage/component-set/toolbar-secondary` | Canvas stage (variant)    | The Toolbar's second Action selected on Toolbar · Light   | None              |
| `design/canvas/stage/document`                        | Canvas stage              | Payment terms as one reading frame                        | None              |
| `design/canvas/stage/document/light-only`             | Canvas stage (variant)    | Payment terms without a dark page: Light only under Dark  | None              |
| `design/canvas/stage/catalogue`                       | Canvas stage              | The catalogue in Changes, naming its base                 | Catalogue         |
| `design/canvas/stage/home`                            | Canvas stage              | Home guidance on the canvas, no right panel               | Catalogue         |
| `design/canvas/inspect/unchanged`                     | Inspect                   | Light-only Profile with the Inspect tab alone             | Inspect           |
| `design/canvas/inspect/selection`                     | Inspect                   | Welcome's View details Action selected on Mobile · Light  | None              |
| `design/canvas/inspect/selection/toolbar`             | Inspect (variant)         | Welcome's Toolbar selected, padded on four sides          | None              |
| `design/canvas/inspect/selection/primary`             | Inspect (variant)         | The Toolbar's first Action selected                       | None              |
| `design/canvas/inspect/selection/secondary`           | Inspect (variant)         | The Toolbar's second Action selected                      | None              |
| `design/canvas/inspect/sections`                      | Inspect                   | Usage and Components unfolded                             | Inspect, expanded |
| `design/canvas/inspect/props`                         | Inspect                   | Props unfolded with Welcome's one prop                    | Inspect           |
| `design/canvas/inspect/frames`                        | Inspect                   | Frames filter with Dark off and the highlight on          | None              |
| `design/canvas/changes/current`                       | Changes                   | Welcome's Changes tab in Current                          | Changes           |
| `design/canvas/changes/side-by-side`                  | Changes                   | Side by side on Desktop · Light                           | None              |
| `design/canvas/changes/overlay`                       | Changes                   | Overlay on every frame                                    | None              |
| `design/canvas/changes/difference`                    | Changes                   | Difference on every frame                                 | None              |
| `design/canvas/changes/swipe`                         | Changes                   | Swipe's divider on every frame                            | None              |
| `design/canvas/outcomes/added`                        | Change outcomes           | Added Details in Inspect, with both tabs                  | None              |
| `design/canvas/outcomes/added/changes`                | Change outcomes (variant) | Added Details' Changes tab, with Current alone            | Changes           |
| `design/canvas/outcomes/added/welcome`                | Change outcomes (variant) | Details' own Action selected from its component tree      | None              |
| `design/canvas/outcomes/added/toolbar`                | Change outcomes (variant) | Details' Toolbar selected                                 | None              |
| `design/canvas/outcomes/added/primary`                | Change outcomes (variant) | The first Action of Details' Toolbar selected             | None              |
| `design/canvas/outcomes/added/secondary`              | Change outcomes (variant) | The second Action of Details' Toolbar selected            | None              |
| `design/canvas/outcomes/moved`                        | Change outcomes           | Invoice · Moved in Overlay on its Light frames            | None              |
| `design/canvas/outcomes/moved/inspect`                | Change outcomes (variant) | Invoice's Inspect, with its Moved from row                | Inspect           |
| `design/canvas/outcomes/removed`                      | Change outcomes           | Removed Farewell's previous version, on its Changes tab   | None              |
| `design/canvas/outcomes/removed/inspect`              | Change outcomes (variant) | Farewell's Inspect, which keeps the base commit's record  | Inspect           |
| `design/canvas/outcomes/removed/long`                 | Change outcomes (variant) | The Survey, a long screen, scrolls inside each frame      | None              |
| `design/canvas/outcomes/removed/loading`              | Change outcomes (variant) | Invite's previous version loads: no section, no zoom pill | None              |
| `design/canvas/outcomes/removed/unavailable`          | Change outcomes (variant) | Archive's previous version failed, with Retry             | None              |
| `design/canvas/outcomes/removed/no-view`              | Change outcomes (variant) | Timeline on Inspect: a note in place of its Mobile frame  | None              |
| `design/canvas/outcomes/removed-document`             | Change outcomes           | The removed Getting started page as one reading frame     | None              |
| `design/canvas/outcomes/removed-document/long`        | Change outcomes (variant) | The Field guide, a long page, scrolls inside its frame    | None              |
| `design/canvas/outcomes/removed-document/loading`     | Change outcomes (variant) | Printing tips' previous version loads                     | None              |
| `design/canvas/outcomes/removed-document/unavailable` | Change outcomes (variant) | Style notes' previous version failed, with Retry          | None              |
| `design/canvas/outcomes/removed-document/light-only`  | Change outcomes (variant) | Payment terms on Inspect: a light-only previous version   | None              |
| `design/canvas/outcomes/removed-variant`              | Change outcomes           | Welcome's removed Save failed as four frames              | Changes           |
| `design/canvas/outcomes/removed-variant/inspect`      | Change outcomes (variant) | Save failed's Inspect, after Welcome's current variants   | Inspect           |
| `design/canvas/flows/tour`                            | Use cases                 | The Example tour: one Desktop · Light frame for each step | None              |
| `design/canvas/flows/tour/mobile`                     | Use cases (variant)       | The Frames filter chooses Mobile                          | Inspect           |
| `design/canvas/flows/tour/dark`                       | Use cases (variant)       | The Frames filter chooses Dark                            | None              |
| `design/canvas/flows/tour/second-step`                | Use cases (variant)       | The phone's frame picker on step 2, Details               | None              |

The entries marked as variants stay under their parent screen in authored
order rather than becoming folder members. The family holds 41 screens and 66
saved variants. `design/canvas/overview` is the family's canonical screen,
and each folder holds at most five screens.

## Family Rules

- Every Canvas screen and variant renders in both schemes and in both
  viewports. The outer viewer shows the two renders of an entry under the
  [preview scheme rules](./mokly-shell-device-chrome.md#color-scheme). In both
  renders, each frame on the canvas shows its own scheme's view. A Markdown
  document's reading frame, such as the one of `design/canvas/stage/document`,
  follows the rendered appearance. A page's reading frame keeps the page's own
  light document in both renders. A document without a dark render keeps its
  light version in both renders, as in
  `design/canvas/stage/document/light-only` and
  `design/canvas/outcomes/removed-document/light-only`.
- Every Canvas artboard draws the top bar with its one Appearance selector,
  which names the scheme that its file was rendered for. The exception is the
  three startup states of `design/canvas/loading/catalogue`. The shell draws
  no chrome before the catalogue arrives, so they draw one status line in
  place of the whole viewer, in the reader's appearance.
- A desktop render draws the floating catalogue and the right panel of a
  selected entry, and turns compact below the shell's breakpoint. It draws
  the zoom pill only while the canvas holds a section, under the
  [canvas stage](./mokly-shell-canvas-stage.md#canvas). A mobile render draws
  the compact layout at every width: the entry bar of a selected entry, with
  the frame picker that the
  [compact layout](./mokly-shell-device-chrome.md#compact-layout) gives it,
  the dock, and only the sheet that the Phone sheet column names. The dock
  holds Fit only while the canvas holds a section.
- Each Canvas screen browses the
  [depicted catalogue](./mokly-shell-design-catalogue.md#canvas-states) on the
  canonical branch or on one of the Canvas branches that the depicted
  catalogue names. Its links stay inside the family, under the
  [Canvas transitions](./mokly-shell-design-catalogue.md#transitions).
- The Canvas screens draw the
  [Canvas viewer parts](./mokly-design-component-library-canvas.md) and the
  shipped parts of the [design library](./mokly-design-component-library.md),
  in the Canvas palette of `@mokly/ui`.
- An artboard links to a Canvas state wherever a depicted control opens that
  state. Catalogue navigation reaches every entry, and it alone reaches a
  state that no depicted control opens, such as the one state of a branch of
  its own. A state that only a runtime transition reaches takes a link only
  from its failure state's retry, under the
  [loading-state retries](./mokly-shell-design-inventory.md#loading-state-retries).

## Use Case And Removed Entries

- `design/canvas/flows/tour` depicts the Example tour of the canonical branch
  as one section of two step frames, Welcome and then Details, under the
  [use case](./mokly-shell-canvas-stage.md#use-case) rules. Its saved
  variants choose Mobile and Dark in the Frames filter, and pick the second
  step in the phone's frame picker.
- The removed outcomes depict a removed entry's previous version under the
  [removed previews](./mokly-removed-previews.md#behavior) rules. Their
  `long`, `loading`, `unavailable` and `no-view` states show other removed
  entries of the parent's Changes list, each selected the way a reader
  selects it. The
  [depicted catalogue](./mokly-shell-design-catalogue.md#depicted-branches)
  names their branches.
- While a previous version loads, or after it failed, the canvas holds that
  state in place of the section, so the artboard draws no zoom pill and no
  dock Fit.
- Served and built previews are identical, so no static-delivery state is
  designed.

## Related Docs

- [Shell design inventory](./mokly-shell-design-inventory.md)
- [Canvas loading, search and evidence inventory](./mokly-shell-canvas-inventory-states.md)
- [Component design inventory](./mokly-component-design-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
- [Shell design contract](./mokly-shell-design.md)
- [Shell canvas stage](./mokly-shell-canvas-stage.md)
- [Removed content previews](./mokly-removed-previews.md)
- [Design mockup links](./mokly-design-links.md)
