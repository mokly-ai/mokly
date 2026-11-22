# Comparison Pane Design References

## Depicted States

The `design/canvas/**` family depicts the pane contract with the
[Changes tab](./mokly-changes-controls.md#changes-tab) of the right panel, in
both viewports and both schemes. Each compare mode applies to every frame on
the canvas, except Side by side, which compares the frame that the chips
choose. Links inside every depicted frame are inert.

| Entry                                           | State                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `design/canvas/changes/current`                 | Current, with the stepper, Compared, the modes and the comparison details      |
| `design/canvas/changes/side-by-side`            | Side by side on the frame that the chips choose, two phone frames on phones    |
| `design/canvas/changes/overlay`                 | Overlay on every frame                                                         |
| `design/canvas/changes/difference`              | Difference on every frame                                                      |
| `design/canvas/changes/swipe`                   | Swipe, with one divider at the same place on every frame                       |
| `design/canvas/outcomes/added/changes`          | An added screen, with Current alone on its rail and as its one mode            |
| `design/canvas/outcomes/moved`                  | A moved screen in Overlay on its Light frames, against its previous path       |
| `design/canvas/components/compare`              | A changed component in Overlay on every frame of its variant set               |
| `design/canvas/components/compare/side-by-side` | Side by side on one frame of the variant set, with a chip for each frame       |
| `design/canvas/components/compare/difference`   | Difference on every frame of the variant set                                   |
| `design/canvas/components/removed/changes`      | A removed variant in Side by side, with a message for its missing current side |
| `design/canvas/components/affected`             | An unmodified screen that a changed component affects, in Side by side         |

Each compared frame shows its documents from their start. A frame scrolls its
own document, so no design draws a scroll position. See
[the shell design](./mokly-shell-design.md#in-place-comparisons) and
[the component design](./mokly-component-design.md) for the complete tables.
