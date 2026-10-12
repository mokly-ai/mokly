# Component Design Inventory

Continuation of [mokly-component-design](./mokly-component-design.md).

## Owning Catalogue

Source lives under `examples/basic/specs/design/components/`; generated
artboards live under `examples/basic/mokly-generated/<path>/` as their path-derived
`index.<viewport>.html` views. The existing
Specs → Design → Component explorer folder reaches every
screen.
The canonical `overview` screen shows a component page, followed by links to the
owning child pages outside the artboard. The original Pages, Inspection, and States child folders are gallery
indexes, each with at most five direct owning screens; inspection also links a nested
selection gallery with two owning screens, and Pages links a nested Stacked
comparisons gallery with three. The Inspector gallery adds two closed
states. Controls has one canonical parent screen and Editing, States, and
Published galleries with four, four, and two screens. The linked inspector and
controls contracts own their additional entry inventories. Every screen has a separate
mobile component and desktop component; there are no new user-flow pages.

| Entry                                                       | State                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `design/components/overview`                                | Action page, default variant, props, and Used by               |
| `design/components/pages/variants`                          | Disabled saved variant                                         |
| `design/components/pages/comparison`                        | Saved variant before/current comparison                        |
| `design/components/pages/stacked/overlay`                   | Saved variant Overlay in one bordered frame                    |
| `design/components/pages/stacked/difference`                | Saved variant Difference in one bordered frame                 |
| `design/components/pages/stacked/overlay-tall`              | Component taller than its frame, part-way down in Overlay      |
| `design/components/pages/affected`                          | One changed component and two affected screens                 |
| `design/components/pages/toolbar`                           | Component consuming Action                                     |
| `design/components/pages/help`                              | Invoked component with no visible region                       |
| `design/components/inspection/inspection-details`           | Repeated instances and selected props                          |
| `design/components/inspection/inspection-highlight`         | Outermost component cutouts                                    |
| `design/components/inspection/inspection-nested`            | Nested Action selected in the screen and Props                 |
| `design/components/inspection/inspection-direct-change`     | Independent screen prop change; two Changes                    |
| `design/components/inspection/inspection-consumer`          | A second screen reached from Used by                           |
| `design/components/inspection/selection/inspection-toolbar` | Selected container with its own props                          |
| `design/components/inspection/selection/inspection-help`    | Selected invisible instance                                    |
| `design/components/states/empty`                            | Validated empty usage                                          |
| `design/components/states/unavailable`                      | Missing inspection metadata                                    |
| `design/components/states/unused`                           | Saved component with no consumers                              |
| `design/components/states/removed`                          | Removed saved variant and former consumer                      |
| `design/components/states/removed-consumer`                 | Former consumer's previous version behind a Removed badge      |
| `design/components/states/additions/added`                  | Added Badge current preview without comparison controls        |
| `design/components/states/shared-impact/shared-impact`      | Unmodified Action with excluded stylesheet evidence in Details |

| `design/components/states/shared-impact/style-changed` | Action changed by its own styles, with affected consumers |
| `design/components/states/shared-impact/style-outside` | Welcome row for a style outside changed Action |

| `design/components/states/loading/usage-loading` | Component Usage waiting for private entry evidence |
| `design/components/states/loading/inspection-loading` | Screen inspection waiting for displayed-view usage |
| `design/components/states/loading/usage-failed` | Usage read failure with a Try again action |

The Loading and recovery folder sits below Empty and change states and contains
exactly these three states. Each entry's files derive from its path under the
[artifact path contract](./mokly-artifact-paths.md): its standalone views are
`<path>/index.mobile.html` and `<path>/index.desktop.html`, and gallery
membership is the entry's folder. All forty-one component
screens opt into light documents, matching the existing shell mockups. Their
depicted preview caption names the artboard's own scheme, and the toolbar has
no scheme switch: the catalogue's one Appearance control, drawn in their top
bar like every other artboard's, sets it. Links use
the path-addressed [link contract](./mokly-authoring.md#links) so they work
both directly from disk and in Browse. State links demonstrate navigation between mockups; static
depictions of shell controls do not implement the separate runtime inspector.

The shared shell retains the [existing design navigation](./mokly-design-links.md)
for brand, home breadcrumb, and the canonical mobile drawer. Component artboards
select their own typed navigation state; they never inherit Welcome's tag,
scheme, inspector, or comparison transitions. Their viewport dropdown and highlight switch work through native form state and CSS. Comparison depictions retain native button focus and pressed states only in eligible change scenarios. In Side by side, Overlay and Difference the band also draws the Scroll together switch, on, after the mode control and before Refresh, as the [shell design](./mokly-shell-design.md#in-place-comparisons) specifies; it toggles in place.
Action's changed Default variant is one comparison family: its mode control
links Current to `design/components/pages/affected`, Side by side to
`design/components/pages/comparison`, and Overlay and Difference to
`design/components/pages/stacked/overlay` and `design/components/pages/stacked/difference`, while the
selected mode stays a pressed button. Every other eligible depiction, including
the tall Checklist, keeps all four modes as buttons. No mode control links into
the Checklist, because it depicts another component; readers reach it beside
Overlay and Difference in its owning Stacked comparisons gallery.
The shared selection control preserves native anchor semantics when an authored
transition exists. Existing Browse and Changes artboards retain their non-link
spans for unsupported controls.
