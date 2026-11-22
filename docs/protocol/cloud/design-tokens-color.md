# Design Token Colors

The color tables of [Design tokens](./design-tokens.md): the semantic roles in
both schemes, the accent family and its one-fill rule, the paper palette of the
Design material and the Folio surfaces of the product and marketing screens.
The contrast requirements and the elevation roles that pair these colors with
hairlines and shadows are in the parent document.

## Colors

| Key under `color` | Light     | Dark      | Use                                      |
| ----------------- | --------- | --------- | ---------------------------------------- |
| `background`      | `#f5f6f4` | `#0f1713` | Page background                          |
| `surface`         | `#ffffff` | `#17221b` | Cards, forms, header                     |
| `surfaceRaised`   | `#ffffff` | `#1e2c23` | Menus and raised panels                  |
| `surfaceMuted`    | `#e9ede8` | `#26372b` | Secondary areas                          |
| `text`            | `#16211b` | `#f1f6f2` | Primary copy and headings                |
| `textMuted`       | `#536258` | `#adc0b1` | Secondary copy                           |
| `border`          | `#d3dbd4` | `#34483a` | Decorative dividers                      |
| `borderStrong`    | `#798a7e` | `#708f7b` | Input boundaries and meaningful outlines |
| `accent`          | `#2f5945` | `#a3cdb4` | Accent ink: links, marks, selection      |
| `accentHover`     | `#24483a` | `#bcdcc9` | Hovered accent ink                       |
| `accentActive`    | `#1c382d` | `#cfe7d8` | Pressed accent ink                       |
| `accentSolid`     | `#4f7864` | `#7aa78e` | The one solid accent fill on a screen    |
| `onAccent`        | `#ffffff` | `#0f1713` | Text and glyphs on accent fills          |
| `accentSoft`      | `#e3eee6` | `#223029` | Selected rows and quiet accent areas     |
| `focus`           | `#0b6bcb` | `#83baff` | Keyboard focus indicator                 |
| `success`         | `#2f5945` | `#a3cdb4` | Success text and icons                   |
| `successSoft`     | `#e3eee6` | `#223029` | Success backgrounds                      |
| `warning`         | `#80570c` | `#f4cd75` | Warning text and icons                   |
| `warningSoft`     | `#fff2ce` | `#3b3015` | Warning backgrounds                      |
| `danger`          | `#b42332` | `#ffafb7` | Error/destructive text and icons         |
| `dangerSoft`      | `#ffe9ea` | `#441e28` | Error backgrounds                        |
| `info`            | `#175cd3` | `#9fc3ff` | Informational text and icons             |
| `infoSoft`        | `#e8f0ff` | `#182f4f` | Informational backgrounds                |

### The Accent Family

The accent is the deep moss of the open-source Mokly Browse shell, so the cloud
sits in the family of the product it hosts. Its two members are not
interchangeable. **`accent` is ink**: legible as text on every surface in its
scheme, it marks links, the selected row's check and accent glyphs, hovering and
pressing to `accentHover` and `accentActive`. **`accentSolid` is a fill**: it
paints the primary action and nothing else, is never used as text, and carries
only `onAccent` as its label color.

In dark, solid fills lighten and `onAccent` darkens to the page ink-well, which
is the shared control library's model. The dark fill is therefore a muted sage
rather than a mint: a fill light enough to carry dark text must stay low in
chroma or it reads as a highlighter.

### At Most One Accent Fill Per Screen

A screen has at most one `accentSolid` fill. When it has a primary action, that
action owns the fill; a state without a primary action invents none. Everything
else is ink, hairline or tint.

- Never put the accent inside a heading; headings are one color.
- Never fill a selected row with the accent. Selection is `accentSoft`, an
  `accentSolid` hairline and a check, so it cannot be read as the primary
  action.
- The Mokly mark keeps its brand accent (`accent` ink) on every surface; it is
  identity, not an action, and does not count against the fill budget. The
  wordmark and its period are `text` in the product chrome.
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

## Folio: Product And Marketing Surfaces

| Token             | Light     | Dark      | Use                                       |
| ----------------- | --------- | --------- | ----------------------------------------- |
| `folio`           | `#faf9f6` | `#18181b` | Page canvas                               |
| `folioMuted`      | `#f1efe9` | `#1d1d20` | Navigation rail, dialog rail, tab bar     |
| `folioSurface`    | `#ffffff` | `#232326` | Cards, panels, dialogs, selected nav pill |
| `folioInk`        | `#23211e` | `#f4f4f5` | Headings and body                         |
| `folioInkMuted`   | `#6d675e` | `#a1a1aa` | Secondary copy                            |
| `folioLine`       | `#e7e3db` | `#34343a` | Decorative hairlines                      |
| `folioLineStrong` | `#8a8478` | `#71717a` | Meaningful control boundaries             |

These three surfaces are one ordered elevation system in both schemes, and dark
is designed rather than inverted: light steps outward from a warm canvas to a
tinted chrome to white content, dark steps upward from a near-black neutral
canvas to a lifted chrome and content surface, never reaching pure black or
white. A surface always announces itself with a hairline as well as a fill.
Dark Folio is a neutral graphite, not a warm brown, so that the cloud chrome
and the dark neutrals of the hosted viewer read as one surface.

In the Folio scope, which every product document carries on its root,
`background` binds to `folio`, `surface` and `surfaceRaised` to
`folioSurface`, `surfaceMuted` to `folioMuted`, and `text`, `textMuted`,
`border` and `borderStrong` to their Folio counterparts. The accent, statuses
and focus do not change with the scope. Washes are mixed from tokens with
`color-mix`: the accent ink at 9% on navigation rows, the ink at 5% on chrome
links, the ink at 34% behind the settings dialog.
