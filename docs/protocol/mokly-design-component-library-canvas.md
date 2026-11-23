# Canvas Viewer Parts Of The Design Library

This continues the
[design component library inventory](./mokly-design-component-library.md). It
lists the eleven parts of the Canvas viewer in the design library: the
`canvas` and `panels` groups, and the Frames filter and the box model of the
`inspector` group. The [Canvas screens](./mokly-shell-canvas-inventory.md)
compose them. The `@mokly/ui` package does not provide these parts, so each
part implements its own markup and its own stylesheet. The
[design components contract](./mokly-design-components.md) gives the rules
that every library component follows.

## Components And Saved Examples

Each row defines parent `design/library/{group}/{slug}` and its variant entries
under the same rules as the
[library inventory](./mokly-design-component-library.md#components-and-saved-examples).

| Group / slug              | Variant names                                                              |
| ------------------------- | -------------------------------------------------------------------------- |
| canvas / canvas-frame     | `desktop-light`, `mobile-dark`, `component`, `document`, `swipe`, `before` |
| canvas / zoom-pill        | `fitted`, `zoomed`, `fit`                                                  |
| canvas / selection        | `action`, `toolbar`, `small`, `frame`                                      |
| canvas / swipe-divider    | `centred`, `moved`                                                         |
| panels / floating-panel   | `catalogue`, `panel`, `sheet`                                              |
| panels / panel-tabs       | `changed`, `unchanged`                                                     |
| panels / phone-dock       | `inspect`, `home`                                                          |
| panels / change-stepper   | `first`, `second`                                                          |
| panels / compare-modes    | `current`, `side-by-side`, `swipe`, `added`                                |
| inspector / frames-filter | `screen`, `component`, `light-only`, `dark-hidden`                         |
| inspector / box-model     | `action`, `toolbar`                                                        |

The samples render light only, in the Canvas palette of `@mokly/ui`, as the
root of a Canvas artboard declares it. A static sample runs no script, so each
control links to the Canvas artboard that shows its outcome, and a control
without a destination is a picture of itself. The Frames filter's toggles and
its switch are native controls that work in place.

## Data, Slots And Controls

1. **Canvas frame:** frame kind `desktop/mobile/component/document`, scheme
   `light/dark`, label, optional entry slug, nominal width and height, zoom,
   optional compare mode `overlay/difference/swipe`, optional Side by side
   version `before/after`, optional variant slug, a selected flag, an optional
   light-only flag, and a use case's optional step number from 1 to 99, screen
   destination and description. Slots: `children` holds the current version,
   `before` the version before, and `overlay` what lies over the frame
   unclipped, such as a selection. Controls: label, scheme, zoom and selected.
   The frame draws its
   label and size tag as the
   [canvas frames](./mokly-shell-device-chrome.md#canvas-frames) say, scales
   its document by the zoom, and in Swipe draws the Swipe divider over both
   versions. A step frame leads its label with the step number in a tag,
   draws the label as the link to the step's screen, and draws the
   description below the label. A light-only frame keeps its light view under
   Dark, and its label adds `Light only` after its name, in a lighter weight.
2. **Zoom pill:** zoom in percent, presentation `pill/fit`, and optional Zoom
   out, Zoom in and Fit destinations. Controls: zoom and presentation. The
   `fit` presentation is Fit alone, as the phone dock holds it.
3. **Selection:** name, width and height, optional padding and border, and the
   selected kind `instance/frame`. Controls: name, width, height, padding,
   border and kind. An instance draws an outline with eight handles, its name
   tag, its size tag, and the redline of its padding where the instance is
   large enough to read. A frame draws an outline with a handle at each corner
   and its size. The marks keep their size at every zoom.
4. **Swipe divider:** the divider's position in percent, from 5 to 95.
   Control: position. It draws the line, its grip, and the `Before` and
   `Current` tags.
5. **Floating panel:** side `left/right`, label, sheet flag and optional close
   destination. Slots: `head`, `children` and `foot`. Controls: label, side and
   sheet. The sheet adds a grabber and a close control named `Close` and the
   label in lower case.
6. **Panel tabs:** one or two tabs, `inspect` and `changes`, each with a label
   and an optional destination, and the selected tab. Control: selected tab.
   The selected tab draws a rule under its label, and every label keeps the
   width of its bold form.
7. **Phone dock:** optional current tab `inspect/changes`, optional zoom, and
   the Catalogue, tab and Fit destinations. Control: current tab. Without a tab
   the dock holds Catalogue alone. Without a zoom it holds no Fit, as while
   the canvas holds no section.
8. **Change stepper:** the shown change's position and the total of changes,
   from 1 to 999, and optional Previous change and Next change destinations.
   Controls: position and total. The first change's Previous change and the
   last change's Next change are disabled.
9. **Compare modes:** mode `current/side-by-side/overlay/difference/swipe`, a
   comparable flag, the Scroll together state, a destination for each mode,
   and, in Side by side, the compared frame, its destination, and an optional
   list of the frames that its chips name. A frame record has an id, a label
   and a kind `desktop/mobile/component`. Without a list, the chips name a
   screen's four frames by viewport and scheme. A variant set gives its own
   frames, named as their labels name them, such as `Action · Light` and
   `Default · Light`.
   Controls: mode, comparable and Scroll together. Each mode is a tile with
   its key. An entry that is not comparable offers Current alone. The compared
   frame's chip links to its destination, and every other chip is a picture of
   itself.
10. **Frames filter:** a viewports flag, the Mobile, Desktop, Light and Dark
    toggles, a light-only flag, a single flag, the Highlight components state,
    and an optional unavailable reason
    `empty/unavailable/loading/failed/comparison/removed` in the shell's own
    words. Controls: the four toggles and highlight. A set without viewports
    has no viewport toggles, and a light-only screen disables Dark. With the
    single flag, as in a use case, each pair of toggles is a pair of native
    radio buttons, so the filter chooses one viewport and one scheme.
11. **Box model:** the padding of each side and the content width and height.
    Controls: each side, the content width and the content height. It is one
    image whose name gives the same numbers in words.

## Related Docs

- [Design component library inventory](./mokly-design-component-library.md)
- [Design components contract](./mokly-design-components.md)
- [Canvas design inventory](./mokly-shell-canvas-inventory.md)
- [Shell canvas stage](./mokly-shell-canvas-stage.md)
