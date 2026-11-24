# Design Token Colors

The color tables of [Design tokens](./design-tokens.md): the semantic roles in
both schemes and their Canvas sources, the accent family and its one-fill
rule, the Canvas surfaces of the product and marketing screens, and the paper
palette of the Design material. The contrast requirements and the elevation
roles that pair these colors with hairlines and shadows are in the parent
document.

## Colors

Canvas is the default surface family. The semantic surface, text, line and
accent roles take their values from the
[Canvas palette](../mokly-viewer-palette.md#canvas-palette) of `@mokly/ui`,
which lists them in both schemes. The token package keeps no copy of them.

| Key under `color` | Canvas role     | Use                                      |
| ----------------- | --------------- | ---------------------------------------- |
| `background`      | `background`    | Page canvas                              |
| `surface`         | `surface`       | Cards, forms, header                     |
| `surfaceRaised`   | `surfaceRaised` | Menus and raised panels                  |
| `surfaceMuted`    | `surfaceMuted`  | Secondary areas                          |
| `text`            | `text`          | Primary copy and headings                |
| `textSecondary`   | `textSecondary` | Descriptions and secondary values        |
| `textMuted`       | `textMuted`     | Secondary copy, labels and counts        |
| `border`          | `border`        | Decorative dividers                      |
| `borderStrong`    | `borderStrong`  | Input boundaries and meaningful outlines |
| `accent`          | `signalDeep`    | Accent ink: links, marks, selection      |
| `accentHover`     | `signalDeep`    | Hovered accent ink                       |
| `accentActive`    | `signalDeep`    | Pressed accent ink                       |
| `accentSolid`     | `signalFill`    | The one solid accent fill on a screen    |
| `onAccent`        | `onSignalFill`  | Text and glyphs on accent fills          |
| `accentSoft`      | `signalSoft`    | Selected rows and quiet accent areas     |

The other Canvas roles keep their Canvas names under `color`: `dot`,
`signal`, `onSignal`, `signalSoft`, `signalDeep`, `signalFill` and
`onSignalFill`, and under `people` the `fill` and `ink` of each person, such
as `--mk-color-people-pink-fill`.

The token package holds the focus and status roles itself:

| Key under `color` | Light     | Dark      | Use                              |
| ----------------- | --------- | --------- | -------------------------------- |
| `focus`           | `#0b6bcb` | `#83baff` | Keyboard focus indicator         |
| `success`         | `#2f5945` | `#a3cdb4` | Success text and icons           |
| `successSoft`     | `#e3eee6` | `#223029` | Success backgrounds              |
| `warning`         | `#80570c` | `#f4cd75` | Warning text and icons           |
| `warningSoft`     | `#fff2ce` | `#3b3015` | Warning backgrounds              |
| `danger`          | `#b42332` | `#ffafb7` | Error/destructive text and icons |
| `dangerSoft`      | `#ffe9ea` | `#441e28` | Error backgrounds                |
| `info`            | `#175cd3` | `#9fc3ff` | Informational text and icons     |
| `infoSoft`        | `#e8f0ff` | `#182f4f` | Informational backgrounds        |

### The Accent Family

The accent is the signal green of Canvas, the green of the open-source Mokly
Browse shell, so the cloud sits in the family of the product it hosts. Its
members are not interchangeable. **`accent` is ink**: `signalDeep`, legible
as text on every surface in its scheme, it marks links, the selected row's
check and accent glyphs. Canvas has no separate hover or pressed ink, so
`accentHover` and `accentActive` keep the same ink. **`accentSolid` is a
fill**: `signalFill`, it paints the primary action and nothing else, is never
used as text, and carries only `onAccent`, the white `onSignalFill`, as its
label color. **`signal` is a mark**: it draws the selections, handles, guides
and size tags of the design-file look, with `onSignal` text on it, and never
paints an action.

The fill and its white label are the same in both schemes, so a filled button
reads the same in light and dark. The pair needs 3:1 rather than 4.5:1, under
the [contrast rule](./design-tokens.md#motion-states-and-validation) of the
parent document.

### At Most One Accent Fill Per Screen

A product screen, in the app or in the viewer, has at most one `accentSolid`
fill. When it has a primary action, that action owns the fill; a state
without a primary action invents none. Everything else is ink, hairline, tint
or a signal mark. The site places its filled actions under
[Site design](./site-design.md).

- Never put the accent inside a heading; headings are one color.
- Never fill a selected row with the accent. Selection is `accentSoft`, an
  `accentSolid` hairline and a check, so it cannot be read as the primary
  action.
- The Mokly mark is identity, not an action, and does not count against the
  fill budget: a `text` outline behind a `signal` front layer with `onSignal`
  rules, as the [shell brand](../mokly-shell-brand.md) draws it. The wordmark
  is `text` with its period in `signal`. Both have one design on every
  surface.
- The signal marks of the design-file look, such as a selection with its
  handles and size tags, show state and do not count against the fill budget.
- A status dot is state, not an action. The shared control paints a success dot
  with the solid accent, and at 8px beside a label that states the same thing in
  words it cannot be mistaken for the primary, so it does not count against the
  fill budget either. The budget covers painted surfaces larger than 16px.
- A switch that is on is a setting's state, not an action. The shared control
  paints its track with the solid accent, and a track with a knob beside the
  label that names the setting cannot be read as the primary button, so it
  does not count against the fill budget either.
- Chrome links are `text` with an underline. A page that spends the accent
  anywhere else has nothing left to spend on the action that matters.
- Outside the product chrome — the Design pages and the illustration material —
  local links keep the `accent` ink, with `accentHover` on hover.

Pair each status color with its matching soft background. Never use decorative
`border` as the sole visible input boundary, and never use color alone to convey
selection, error or approval.

## Paper Palette: Design Material

Registered Design previews and the illustration material use these paper
roles; the accent roles above are shared:

| Key under `color` | Light     | Dark      | Use                            |
| ----------------- | --------- | --------- | ------------------------------ |
| `paper`           | `#f8f6ef` | `#191b16` | Warm page canvas               |
| `paperMuted`      | `#eceee3` | `#262b22` | Tinted workflow band           |
| `paperSurface`    | `#fffdf7` | `#22251e` | Notes and browser illustration |
| `paperInk`        | `#302f28` | `#f4f2e9` | Paper headings and body        |
| `paperInkMuted`   | `#64685b` | `#b8c0ab` | Secondary paper copy           |
| `paperLine`       | `#dcded2` | `#404638` | Decorative rules and dot grid  |
| `paperLineStrong` | `#808774` | `#879477` | Meaningful paper boundaries    |
| `artSage`         | `#e8eddf` | `#303b29` | Screen art tile                |
| `artMint`         | `#e4eee7` | `#233b2d` | Journey art tile               |
| `artOlive`        | `#ebecdf` | `#353925` | Change art tile                |
| `windowClose`     | `#ff5f57` | `#ff5f57` | Mac window close button        |
| `windowMinimize`  | `#febc2e` | `#febc2e` | Mac window minimize button     |
| `windowZoom`      | `#28c840` | `#28c840` | Mac window zoom button         |

## Canvas: Product And Marketing Surfaces

The Canvas surfaces are one ordered elevation system in both schemes, and dark
is designed rather than inverted. Light steps up from the dotted `background`
canvas to white `surface` frames, panels and cards, with `surfaceMuted` one
step below a surface for fields and panel feet. Dark steps up from a
near-black graphite canvas to lifted surfaces, never reaching pure black or
white. Dark Canvas is a neutral graphite with no hue tint. A surface always
announces itself with a hairline as well as a fill.

Every product and marketing document binds its semantic roles to Canvas. The
paper scope of the Design material rebinds only the surface, text and line
roles; the accent, statuses and focus do not change with the scope. Washes
are mixed from tokens with `color-mix`: the accent ink at 9% on navigation
rows, the ink at 5% on chrome links, and the scrim of the
[Overlay role](./design-tokens.md#radius-elevation-and-focus) behind the
settings dialog and the viewer's panels: `text` at 24% in light and
`background` at 60% in dark, with no blur.
