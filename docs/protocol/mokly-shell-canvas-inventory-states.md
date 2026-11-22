# Canvas Loading, Search And Evidence Inventory

This continues the [Canvas design inventory](./mokly-shell-canvas-inventory.md).
It lists three folders of the `design/canvas` family: Loading and recovery,
Search, and Comparison evidence. The columns of the
[Canvas inventory](./mokly-shell-canvas-inventory.md#inventory) and its
[family rules](./mokly-shell-canvas-inventory.md#family-rules) apply to every
entry here.

## Inventory

| Entry                                           | Folder                         | State                                                                   | Phone sheet       |
| ----------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- | ----------------- |
| `design/canvas/loading/catalogue`               | Loading and recovery           | `Loading catalogue…` in place of the whole viewer                       | None              |
| `design/canvas/loading/catalogue/failed`        | Loading and recovery (variant) | The catalogue could not be loaded, with Try again                       | None              |
| `design/canvas/loading/catalogue/version`       | Loading and recovery (variant) | A catalogue from another Mokly version, with Reload                     | None              |
| `design/canvas/loading/entry`                   | Loading and recovery           | Welcome's stage holds `Loading preview…` while its detail loads         | None              |
| `design/canvas/loading/entry/failed`            | Loading and recovery (variant) | Welcome's detail could not be loaded, with Try again                    | None              |
| `design/canvas/loading/changes`                 | Loading and recovery           | The Changes filter checks for changes, with Welcome on the canvas       | Catalogue         |
| `design/canvas/loading/changes/preparing`       | Loading and recovery (variant) | `Preparing comparison`, the one message with a second line              | Catalogue         |
| `design/canvas/loading/changes/unavailable`     | Loading and recovery (variant) | Changes unavailable, with a dash in the count                           | Catalogue         |
| `design/canvas/loading/changes/empty`           | Loading and recovery (variant) | A branch without changes: the count reads 0                             | Catalogue         |
| `design/canvas/loading/changes/without-changes` | Loading and recovery (variant) | A catalogue without comparison data: no filter, no base, no Changes tab | Catalogue         |
| `design/canvas/loading/missing`                 | Loading and recovery           | Item not found on the canvas, with a link to the catalogue home         | None              |
| `design/canvas/search/tags`                     | Search                         | Welcome with an empty query and the tag picker open                     | Tag picker        |
| `design/canvas/search/tags/forms`               | Search (variant)               | `tag:forms`, picker closed: Welcome, Details and the Action stay        | None              |
| `design/canvas/search/tags/forms-picker`        | Search (variant)               | The forms filter with the picker open                                   | Tag picker        |
| `design/canvas/search/tags/onboarding`          | Search (variant)               | `tag:onboarding`, picker closed: Welcome alone stays                    | None              |
| `design/canvas/search/tags/onboarding-picker`   | Search (variant)               | The onboarding filter with the picker open                              | Tag picker        |
| `design/canvas/evidence/styles`                 | Comparison evidence            | Welcome in Side by side: the matched stylesheet, then the excluded one  | Changes           |
| `design/canvas/evidence/styles/unresolved`      | Comparison evidence (variant)  | A stylesheet change that can apply anywhere on Welcome                  | Changes           |
| `design/canvas/evidence/styles/unnamed`         | Comparison evidence (variant)  | The same reach with no style name, so no list follows                   | Changes           |
| `design/canvas/evidence/styles/excluded`        | Comparison evidence (variant)  | The same branch in All: Welcome's Changes tab in Current                | Changes           |
| `design/canvas/evidence/unchanged`              | Comparison evidence            | Details outside Changes: Inspect keeps the excluded stylesheet          | Inspect, expanded |
| `design/canvas/evidence/unchanged/action`       | Comparison evidence (variant)  | The unmodified Action keeps its examined stylesheet in Inspect          | Inspect, expanded |
| `design/canvas/evidence/page`                   | Comparison evidence            | The changed Getting started page: its Changes tab names each stylesheet | Changes           |
| `design/canvas/evidence/page/inspect`           | Comparison evidence (variant)  | The page's Inspect, which holds its head alone                          | Inspect           |
| `design/canvas/evidence/ignored`                | Comparison evidence            | Welcome with only excluded content changed: Inspect names that content  | Inspect, expanded |

## Loading And Recovery

- The three startup states of `design/canvas/loading/catalogue` depict the
  shell before its catalogue index arrives, the index failure, and the version
  failure of the [viewer namespace](./mokly-viewer-namespace.md), under
  [shell delivery](./mokly-shell-delivery.md). The reader's appearance applies
  before the catalogue arrives, so they render in both schemes too.
- `design/canvas/loading/entry` depicts the stage while the selected entry's
  detail loads, and while a replaced catalogue loads. It and its failed
  variant keep the catalogue and Inspect, and the stage holds the state in
  place of the frames. The canvas then holds no section, so they draw no zoom
  pill on desktop and no Fit in the dock on a phone, as the
  [canvas stage](./mokly-shell-canvas-stage.md#canvas) requires.
- The Changes states keep the filter, the count slot and the tree in their
  places, so nothing moves when the result arrives, under the
  [catalogue panel design](./mokly-shell-design-navigation.md#catalogue-panel).
  Entries carry no change status until the comparison is ready, so Welcome has
  the Inspect tab alone while Changes checks, prepares or is unavailable.
- `design/canvas/loading/missing` names the requested path and links to the
  catalogue home. The catalogue stays beside it. Nothing is selected, so no
  right panel shows.

## Search And Evidence

- The tag search states agree on the query, the picker, Inspect's tag chips
  and the catalogue rows. A filter keeps the rows that declare its tag. The
  forms filter keeps the Action, because its definition declares `forms`.
- The comparison evidence states depict branches of their own, which the
  [depicted catalogue](./mokly-shell-design-catalogue.md#depicted-branches)
  names. An entry that Changes lists, or that stays comparable, keeps its
  evidence in its Changes tab. An entry without Changes keeps its evidence in
  Inspect, after the head, and its last line says that the entry did not
  change. The [CSS evidence in the shell](./mokly-css-evidence-shell.md) and
  the [CSS evidence presentation](./mokly-css-evidence-presentation.md) give
  the words of the evidence.
- A page is read whole and never compared, so the Changes tab of
  `design/canvas/evidence/page` holds no compare modes.

## Related Docs

- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Depicted design catalogue](./mokly-shell-design-catalogue.md)
- [Shell delivery](./mokly-shell-delivery.md)
- [Shell navigation design](./mokly-shell-design-navigation.md)
- [CSS evidence in the shell](./mokly-css-evidence-shell.md)
