# Viewer Semantic Palette

Status: The canvas selection and the Changes tab, whose parts read this palette, are not built yet. [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds them.

The shell draws in Canvas, the look of a design file: a dot-grid canvas,
white frames and panels with hairlines, near-black ink, one signal green, and
Geist with Geist Mono. Dark uses neutral graphite with a lighter signal green.
This page holds the Canvas palette, the roles of the shell theme that take its
values, and their recorded contrast. The
[preview palette](./mokly-viewer-palette-preview.md) holds the colours of
what a frame shows.

## Canvas Palette

`@mokly/ui/palette` exports the named palettes as data, and `canvas` is the
one palette. It is the one source of every Canvas colour and font. The
`@mokly/ui` theme stylesheet and the `mokly-html` Markdown style are generated
from it, and Mokly Cloud's token package imports its shared values from it. A
drift check compares each generated file with the module. Decision: one
open-source source for every surface, not hand-kept copies in each consumer
or a second palette for the cloud (decision 1, option D), because one source
cannot drift and the open-source viewer must look like the product on the
site.

Each scheme has these roles, each an opaque six-digit hex value:

| Role            | Light     | Dark      | Use                                        |
| --------------- | --------- | --------- | ------------------------------------------ |
| `background`    | `#f1f2ee` | `#111113` | The canvas behind every frame and panel    |
| `dot`           | `#c9cec5` | `#2b2b30` | The dots of the canvas grid                |
| `surface`       | `#ffffff` | `#1b1b1e` | Frames, panels and cards                   |
| `surfaceRaised` | `#ffffff` | `#232326` | Popovers, menus and selected rows          |
| `surfaceMuted`  | `#f7f8f5` | `#161618` | Fields, rails and panel feet               |
| `text`          | `#0d1410` | `#f4f4f5` | Headings, body text and icons              |
| `textSecondary` | `#434c46` | `#d4d4d8` | Descriptions and secondary values          |
| `textMuted`     | `#626a64` | `#a1a1aa` | Labels, frame labels, size tags and counts |
| `border`        | `#e1e4de` | `#2c2c31` | Decorative hairlines                       |
| `borderStrong`  | `#626a64` | `#71717a` | Control boundaries and meaningful outlines |
| `signal`        | `#12b76a` | `#22c97d` | Selections, handles, guides and size tags  |
| `onSignal`      | `#04130b` | `#04130b` | Text and glyphs on `signal`                |
| `signalSoft`    | `#e3f6ec` | `#0f2a1d` | Selected rows and approved states          |
| `signalDeep`    | `#067a45` | `#5be3a0` | Signal text, icons and focus rings         |
| `signalFill`    | `#109f5c` | `#109f5c` | The fill of a filled button                |
| `onSignalFill`  | `#ffffff` | `#ffffff` | The label of a filled button               |

The `people` roles colour each person or agent on a shared canvas: a `fill`
for the cursor, the selection and the name label, and an `ink` for text on
that fill.

| Person   | Light fill and ink   | Dark fill and ink    |
| -------- | -------------------- | -------------------- |
| `pink`   | `#d61f69`, `#ffffff` | `#f0528f`, `#111113` |
| `blue`   | `#2563eb`, `#ffffff` | `#5b8cff`, `#111113` |
| `orange` | `#f97316`, `#1f0e02` | `#ff8b3d`, `#111113` |
| `violet` | `#7c3aed`, `#ffffff` | `#a07aff`, `#111113` |

The `sans` stack is `"Geist", ui-sans-serif, system-ui, -apple-system,
"Segoe UI", sans-serif`, and the `mono` stack is `"Geist Mono", ui-monospace,
"SFMono-Regular", Menlo, monospace`. Each consumer that draws in Canvas
self-hosts Geist and Geist Mono under the SIL Open Font License. No page loads
a font from a third-party host. Each Markdown document loads the faces that
the viewer delivers, under the
[closure rule](./mokly-public-closure.md#referenced-closure).

`text`, `textSecondary`, `textMuted` and `signalDeep` read at 4.5:1 on
`background`, on every surface and on `signalSoft`. `onSignal` on `signal`
and each person's `ink` on its `fill` read at 4.5:1. `borderStrong` reaches
3:1 on `background`, on every surface and on `signalSoft`. `onSignalFill` on
`signalFill` reaches 3:1, at 3.42:1. Decision: keep this green fill with a
white label in both schemes and accept 3:1 for this one pair (decision 4,
option A), not a darker green or an ink label at 4.5:1, because the design
chose this fill and every surface draws its filled buttons with it. Every
other text pair keeps 4.5:1.

## Interface Palette

One palette serves both appearances. Each shell root, and each design
artboard, states one appearance on its own root, and every role keeps its
meaning in both. The theme declares every Canvas role in both appearances, so
that every part that draws in Canvas can read it, such as the canvas, its
frames, the selection and the size tags. A Canvas role or stack takes the name
`--cv-` and its palette name in kebab case, such as `--cv-surface-raised`,
`--cv-people-pink-fill` and `--cv-mono`. The theme's own roles below take
their values from the Canvas roles. Names below are the theme's role names.

### Swatches

| Role                                       | Canvas source                                       |
| ------------------------------------------ | --------------------------------------------------- |
| `--chrome-bg`                              | `background`                                        |
| `--chrome-surface`                         | `surface`                                           |
| `--chrome-raised`                          | `surface`: the floating catalogue                   |
| `--chrome-hover`                           | `text` at 5% over `surface`                         |
| `--chrome-ink`                             | `text`                                              |
| `--chrome-ink-2`                           | `textSecondary`                                     |
| `--chrome-muted`                           | `textMuted`                                         |
| `--chrome-border`                          | `border`                                            |
| `--chrome-border-strong`                   | `textMuted` at 32% over `surface`                   |
| `--chrome-control-edge`                    | `borderStrong`                                      |
| `--chrome-accent`                          | `signalDeep`                                        |
| `--_mokly-private-accent-default`          | `signalDeep`: the default of `--mokly-accent`       |
| `--mbk-accent-deep`                        | `signalDeep`                                        |
| `--_mokly-private-accent-contrast-default` | `surface`: the default of `--mokly-accent-contrast` |
| `--_mokly-private-accent-soft-default`     | `signalSoft`: the default of `--mokly-accent-soft`  |
| `--_mokly-private-on-ink`                  | `surface`                                           |
| `--_mokly-private-on-accent-deep`          | `surface`                                           |
| `--mbk-accent-surface`                     | `signalSoft`                                        |
| `--mbk-accent-edge`                        | `signal` at 45% opacity                             |
| `--mbk-guide`                              | `border`                                            |
| `--mbk-dot`                                | `dot`                                               |
| `--chrome-count-bg`                        | `text` at 8% opacity                                |
| `--chrome-scrim`                           | the shade at 40% opacity                            |

Each mix is the colour of its two roles mixed in sRGB at that share. The shade
is `text` in Light and `background` in Dark. Each shadow layers the shade, and
Dark adds a 1px `text` ring:

| Role                                           | Light                                                                   | Dark                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `--chrome-shadow-soft`                         | `0 1px 0` at 3%, `0 1px 2px` at 6%                                      | ring at 3%, `0 1px 2px` at 50%                                    |
| `--chrome-shadow` and `--chrome-shadow-drawer` | `0 1px 1px` at 5%, `0 10px 20px -6px` at 8%, `0 40px 80px -28px` at 26% | ring at 5%, `0 14px 28px -8px` at 55%, `0 48px 96px -32px` at 70% |
| `--chrome-shadow-sheet`                        | `0 -18px 40px -18px` at 28%                                             | `0 -18px 40px -18px` at 60%, no ring                              |

The roles without a Canvas source keep fixed values:

| Role                     | Light                                    | Dark                                  |
| ------------------------ | ---------------------------------------- | ------------------------------------- |
| `--chrome-shadow-press`  | `inset 0 1px 2px rgba(20, 28, 22, 0.14)` | `inset 0 1px 2px rgba(0, 0, 0, 0.55)` |
| `--chrome-disabled-bg`   | `#e6ebe7`                                | `#1d1d20`                             |
| `--chrome-disabled-edge` | `#d7dfd9`                                | `#34343a`                             |
| `--chrome-disabled-ink`  | `#5d6f63`                                | `#a1a1aa`                             |

Status and validation pairs keep fixed values. Added takes `signalDeep` text
on `signalSoft`, the selected-state pair, so one family covers both jobs.
Unmodified keeps `--chrome-ink-2` without a fill, and every status badge draws
`--chrome-border`.

| Role                        | Light     | Dark      |
| --------------------------- | --------- | --------- |
| `--mbk-status-changed-bg`   | `#fff7e6` | `#332a15` |
| `--mbk-status-changed-edge` | `#ead6ac` | `#5d4d24` |
| `--mbk-status-changed-ink`  | `#805d1d` | `#e6c179` |
| `--mbk-status-removed-bg`   | `#fcefee` | `#331f1d` |
| `--mbk-status-removed-edge` | `#ecc5c1` | `#5e3b37` |
| `--mbk-status-removed-ink`  | `#9b433c` | `#f1a99c` |
| `--mbk-danger-bg`           | `#fcf0ed` | `#331f1d` |
| `--mbk-danger-edge`         | `#edcdc5` | `#5e3b37` |
| `--mbk-danger-ink`          | `#964334` | `#f1a99c` |

## Recorded Contrast

| Pair                                           | Light | Dark  | Requirement  |
| ---------------------------------------------- | ----- | ----- | ------------ |
| ink on surface                                 | 18.67 | 15.63 | 4.5 text     |
| ink on background                              | 16.60 | 17.15 | 4.5 text     |
| secondary ink on surface                       | 8.89  | 11.62 | 4.5 text     |
| secondary ink on background                    | 7.91  | 12.76 | 4.5 text     |
| muted on surface                               | 5.57  | 6.70  | 4.5 text     |
| muted on background                            | 4.96  | 7.35  | 4.5 text     |
| muted on muted surface (fields, panel feet)    | 5.23  | 7.05  | 4.5 text     |
| muted on hover surface                         | 5.02  | 5.88  | 4.5 text     |
| accent link on surface                         | 5.41  | 10.58 | 4.5 text     |
| accent link on background                      | 4.81  | 11.62 | 4.5 text     |
| deep accent on accent surface                  | 4.81  | 9.45  | 4.5 text     |
| ink on accent surface (selected row)           | 16.59 | 13.95 | 4.5 text     |
| accent contrast on accent (active row)         | 5.41  | 10.58 | 4.5 text     |
| on-signal text on signal (tags)                | 7.25  | 8.81  | 4.5 text     |
| button label on button fill                    | 3.42  | 3.42  | 3 (decision) |
| control edge on surface                        | 5.57  | 3.55  | 3 non-text   |
| control edge on background                     | 4.96  | 3.90  | 3 non-text   |
| control edge on accent surface                 | 4.95  | 3.17  | 3 non-text   |
| focus outline (deep accent) on background      | 4.81  | 11.62 | 3 non-text   |
| state boundary (deep accent) on accent surface | 4.81  | 9.45  | 3 non-text   |
| brand mark outline on surface                  | 18.67 | 15.63 | 3 non-text   |
| validation ink on validation surface           | 5.97  | 8.04  | 4.5 text     |
| disabled ink on disabled surface               | 4.43  | 6.56  | disabled     |
| changed status ink on its surface              | 5.62  | 8.27  | 4.5 text     |
| removed status ink on its surface              | 5.73  | 8.04  | 4.5 text     |
| added status ink on its surface                | 4.81  | 9.45  | 4.5 text     |
| validation message on surface                  | 6.66  | 8.91  | 4.5 text     |

`--chrome-border`, `--chrome-border-strong` and `--mbk-guide` are decorative
hairlines separating adjacent surfaces, not control boundaries, so they are not
held to 3:1. Every control outline, grip, field border and focus ring uses
`--chrome-control-edge` or `--mbk-accent-deep` instead. A control that marks its
hovered, selected or checked state with a boundary draws it in
`--mbk-accent-deep`.

The brand mark's `text` outline keeps the mark visible at 3:1 on every
surface. Its `signal` front layer and the `signal` period of the wordmark are
identity, so they have no contrast minimum. The
[brand contract](./mokly-shell-brand.md) owns the mark.

One family is exempt. The Added, Changed and Removed status badges and the
validation alert are labels rather than controls: each names its own state in
4.8:1 or better text inside a distinct tinted fill, so its outline adds no
information and is held to the decorative hairline standard. The badges draw
`--chrome-border`, and the alert draws `--mbk-danger-edge`.

Nine controls keep a hairline boundary. These draw `--chrome-border`: the
segmented control group, such as the All/Changes filter; the compare-mode tiles
and frame chips of the Changes tab; a pressed icon control, such as the
Highlight components toggle; a resting tag chip; a selected instance of the
component tree; and the address pill and expand toggle of a browser frame's
bar. The resting resize grip on the floating catalogue's edge and the hovered
toggle draw `--chrome-border-strong`. The group fills its selected segment, a
selected tile and a chosen frame chip draw a `--mbk-accent-deep` edge, the chip
also fills with `signalSoft`, and the grip draws the accent while hovered,
focused or dragged. A pressed icon control and a selected instance fill with
the accent tint and draw their glyph or text in the accent, and a selected tag
chip fills with the accent. On hover, the address pill draws its copy glyph and
the toggle its glyph in the accent. Decision: the shipped hairlines, not the
control edge, because each control already shows its state through a fill or
the accent, a frame chip's label also names its frame, and the design mockups
render them. No other boundary may claim these exceptions; a control state that
draws a boundary must reach 3:1 against its own fill or the surface around it.

Disabled controls are outside the contrast minimums, as WCAG allows. They use
`--chrome-disabled-bg`, `--chrome-disabled-edge` and `--chrome-disabled-ink`
rather than a dimmed copy of the enabled colours, so a disabled control reads
the same way in both appearances. An icon control without a fill or an edge at
rest, such as Previous change, Next change or Highlight components, dims to 42%
opacity instead, also while it is pressed. Decision: dimming, not the disabled
tokens, because on such a control the disabled ink reads almost as enabled.

## Role Use

- `--chrome-muted` carries breadcrumbs, frame labels, size tags, navigation
  heads, counts and field hints as normal text.
- `--chrome-control-edge` draws the boundary of the appearance control, the
  mobile sheet grabber and native fields, including the prop field's input
  border. The view controls draw no boundary at rest.
  `--chrome-border-strong` keeps the pane frames.
- The invalid-field border uses `--mbk-danger-ink`, matching the message it
  accompanies.

## Preview Tokens

The [preview palette](./mokly-viewer-palette-preview.md) holds the preview
tokens: the colours of what a frame shows, which never change with the
interface appearance. It also holds the highlight mask and the component
explorer's preview tokens.

## Related Docs

- [Viewer appearance](./mokly-viewer-appearance.md)
- [Viewer preview palette](./mokly-viewer-palette-preview.md)
- [Shell brand](./mokly-shell-brand.md)
- [Shell design contract](./mokly-shell-design.md)
