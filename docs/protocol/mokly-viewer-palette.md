# Viewer Semantic Palette

## Delivery Status

These are the approved swatches for the
[appearance contract](./mokly-viewer-appearance.md), which carries the delivery
status for every appearance surface. They are implemented in the design mockups
under `examples/basic/generated/` (`design.css` for the interface palette,
`design-stage.css` for preview tokens) and adopted by the package's own
`SHELL_CSS` and scoped embedded stylesheet. The same roles now paint standalone
Auto/Light/Dark documents and independently themed embedded roots.

Contrast ratios below are computed from the listed sRGB values using the
[WCAG relative-luminance formula](https://www.w3.org/WAI/GL/wiki/Relative_luminance)
and are rounded down to two decimals. Normal text needs 4.5:1, large text 3:1,
and required control, state and focus graphics 3:1 against adjacent colors.

## Interface Palette

One palette serves both appearances; each artboard selects one on its own root
through `data-mbk-appearance`, and every role keeps its meaning. Names below are
the mockup token names.

### Cloud Alignment

Dark interface neutrals follow the Folio family used by Mokly Cloud's app,
as defined in
[`ts/tokens/src/tokens.ts` at `1b8c523`](https://github.com/mokly-ai/mokly-cloud/blob/1b8c523c7816cbd2e26d88438dbb29d106bdf12b/ts/tokens/src/tokens.ts).
The cloud app selects that family through `paletteUiTheme(scheme, "folio")`;
the base green and retained Paper families are not the product reference.

| Viewer dark role                            | Cloud dark role   |
| ------------------------------------------- | ----------------- |
| Background                                  | `folio`           |
| Panels                                      | `folioSurface`    |
| Navigation, browser bars and disabled fills | `folioMuted`      |
| Primary text                                | `folioInk`        |
| Secondary, muted and disabled text          | `folioInkMuted`   |
| Dividers, guides and disabled borders       | `folioLine`       |
| Strong borders and control edges            | `folioLineStrong` |

Hover uses 5% Folio ink over its panel surface, rounded to `#2c2925`.
Dots and count fills use the same ink with their recorded alpha. Sage accents,
status colors, Light appearance and authored preview colors keep their own
roles. Mockups and runtime adopt these values locally; no cloud package or
network request is needed to render the viewer.

### Swatches

| Role                     | Light                                    | Dark                                  |
| ------------------------ | ---------------------------------------- | ------------------------------------- |
| `--chrome-bg`            | `#f4f4f1`                                | `#161512`                             |
| `--chrome-surface`       | `#ffffff`                                | `#221f1b`                             |
| `--chrome-raised`        | `#fbfbfa`                                | `#1c1b17`                             |
| `--chrome-hover`         | `#f4f6f3`                                | `#2c2925`                             |
| `--chrome-ink`           | `#1a1d1c`                                | `#f0ece4`                             |
| `--chrome-ink-2`         | `#4a4f4d`                                | `#b2aba0`                             |
| `--chrome-muted`         | `#676e6a`                                | `#b2aba0`                             |
| `--chrome-border`        | `#e3e5e0`                                | `#302d28`                             |
| `--chrome-border-strong` | `#c8ccc4`                                | `#8b8478`                             |
| `--chrome-control-edge`  | `#868e88`                                | `#8b8478`                             |
| `--chrome-accent`        | `#2a4733`                                | `#a5cdb6`                             |
| `--mbk-sage`             | `#4f7864`                                | `#86b79b`                             |
| `--mbk-sage-deep`        | `#2f5945`                                | `#b6d8c4`                             |
| `--mbk-accent-contrast`  | `#ffffff`                                | `#0e1a14`                             |
| `--mbk-accent-soft`      | `rgba(79, 120, 100, 0.1)`                | `rgba(134, 183, 155, 0.16)`           |
| `--mbk-accent-surface`   | `#edf3ef`                                | `#24312a`                             |
| `--mbk-accent-edge`      | `#b9cfc2`                                | `#3c5648`                             |
| `--mbk-guide`            | `#dbded8`                                | `#302d28`                             |
| `--mbk-dot`              | `rgba(20, 28, 22, 0.05)`                 | `rgba(240, 236, 228, 0.07)`           |
| `--mbk-browser-bar`      | `#ecede9`                                | `#1c1b17`                             |
| `--chrome-count-bg`      | `rgba(20, 28, 22, 0.08)`                 | `rgba(240, 236, 228, 0.1)`            |
| `--chrome-scrim`         | `rgba(20, 28, 22, 0.45)`                 | `rgba(0, 0, 0, 0.55)`                 |
| `--chrome-shadow`        | `0 30px 90px rgba(20, 28, 22, 0.14)`     | `0 30px 90px rgba(0, 0, 0, 0.6)`      |
| `--chrome-shadow-soft`   | `0 1px 2px rgba(20, 28, 22, 0.1)`        | `0 1px 2px rgba(0, 0, 0, 0.5)`        |
| `--chrome-shadow-press`  | `inset 0 1px 2px rgba(20, 28, 22, 0.14)` | `inset 0 1px 2px rgba(0, 0, 0, 0.55)` |
| `--chrome-shadow-drawer` | `0 18px 50px rgba(20, 28, 22, 0.3)`      | `0 18px 50px rgba(0, 0, 0, 0.6)`      |
| `--chrome-shadow-sheet`  | `0 6px 28px rgba(36, 55, 43, 0.15)`      | `0 6px 28px rgba(0, 0, 0, 0.55)`      |
| `--chrome-disabled-bg`   | `#e6ebe7`                                | `#1c1b17`                             |
| `--chrome-disabled-edge` | `#d7dfd9`                                | `#302d28`                             |
| `--chrome-disabled-ink`  | `#5d6f63`                                | `#b2aba0`                             |

Status and validation pairs. Added reuses the accent surface, edge and deep
accent ink so one selected-state family covers both jobs. Unmodified and
Ignored use `--chrome-muted` on `--chrome-surface` inside `--chrome-border`.

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

| Pair                                         | Light | Dark  | Requirement |
| -------------------------------------------- | ----- | ----- | ----------- |
| ink on surface                               | 16.98 | 13.92 | 4.5 text    |
| ink on background                            | 15.41 | 15.49 | 4.5 text    |
| secondary ink on surface                     | 8.34  | 7.20  | 4.5 text    |
| muted on surface                             | 5.23  | 7.20  | 4.5 text    |
| muted on background                          | 4.74  | 8.02  | 4.5 text    |
| muted on raised (navigation)                 | 5.05  | 7.57  | 4.5 text    |
| muted on hover surface                       | 4.81  | 6.35  | 4.5 text    |
| accent link on surface                       | 10.25 | 9.38  | 4.5 text    |
| sage on surface                              | 4.99  | 7.23  | 4.5 text    |
| deep sage on surface                         | 7.96  | 10.63 | 4.5 text    |
| deep sage on accent surface                  | 7.08  | 8.79  | 4.5 text    |
| accent contrast on sage (active row)         | 4.99  | 7.87  | 4.5 text    |
| control edge on surface                      | 3.36  | 4.42  | 3 non-text  |
| control edge on background                   | 3.05  | 4.92  | 3 non-text  |
| control edge on raised (navigation)          | 3.25  | 4.65  | 3 non-text  |
| focus outline (deep sage) on background      | 7.23  | 11.83 | 3 non-text  |
| state boundary (deep sage) on accent surface | 7.08  | 8.79  | 3 non-text  |
| validation ink on validation surface         | 5.97  | 8.04  | 4.5 text    |
| disabled ink on disabled surface             | 4.43  | 7.57  | disabled    |
| changed status ink on its surface            | 5.62  | 8.27  | 4.5 text    |
| removed status ink on its surface            | 5.73  | 8.04  | 4.5 text    |
| added status ink on its surface              | 7.08  | 8.79  | 4.5 text    |
| validation message on surface                | 6.66  | 8.51  | 4.5 text    |

`--chrome-border`, `--chrome-border-strong` and `--mbk-guide` are decorative
hairlines separating adjacent surfaces, not control boundaries, so they are not
held to 3:1. Every control outline, grip, field border and focus ring uses
`--chrome-control-edge` or `--mbk-sage-deep` instead. A control that marks its
hovered, selected or checked state with a boundary uses `--mbk-sage-deep`,
because `--chrome-control-edge` reaches only 2.99:1 on `--mbk-accent-surface`,
the fill those states carry.

One family is exempt. The `--mbk-status-*-edge` tokens, `--mbk-accent-edge` and
`--mbk-danger-edge` outline the Added, Changed and Removed status badges and the
validation alert, which are labels rather than controls: each names its own
state in 5.62:1 or better text inside a distinct tinted fill, so the outline
adds no information and is held to the decorative hairline standard. No other
boundary may claim this exception; a control state that draws a boundary must
reach 3:1 against its own fill or the surface around it.

Disabled controls are outside the contrast minimums, as WCAG allows. They use
`--chrome-disabled-bg`, `--chrome-disabled-edge` and `--chrome-disabled-ink`
rather than a dimmed copy of the enabled colours, so a disabled control reads
the same way in both appearances.

## Light Corrections

Adopting these roles changed three Light values that did not meet the criteria.
The mockups record the corrected appearance.

1. `--chrome-muted` moved from `#7d8480` to `#676e6a`. It carries breadcrumbs,
   frame captions, navigation heads, counts and field hints as normal text, and
   reached only 3.83:1 on `--chrome-surface`.
2. Control boundaries moved from `--chrome-border-strong` `#c8ccc4` (1.63:1) and
   the prop field's own `#cbd2cc` input border (1.53:1) to the new
   `--chrome-control-edge` `#868e88`. This covers the preview and appearance
   controls, the navigation and inspector resize grips, the mobile sheet grabber
   and native fields. `--chrome-border-strong` keeps the device and pane frames.
3. The invalid-field border moved from `#b55646` to `--mbk-danger-ink` `#964334`,
   matching the message it accompanies.

## Preview Tokens

Preview tokens describe what a device screen shows and never change with the
interface appearance, so a light phone inside a dark catalogue keeps light
surfaces, ink and status indicators.

| Role                       | Light preview | Dark preview                        |
| -------------------------- | ------------- | ----------------------------------- |
| `--mbk-screen-bg`          | `#ffffff`     | `--mbk-dark-screen-bg` `#121514`    |
| `--mbk-screen-ink`         | `#1a1d1c`     | `--mbk-dark-screen-ink` `#eef1ef`   |
| `--mbk-screen-ink-2`       | `#4a4f4d`     | 78% ink mixed into the dark surface |
| `--mbk-screen-muted`       | `#7d8480`     | 62% ink mixed into the dark surface |
| `--mbk-screen-border`      | `#e3e5e0`     | 12% ink mixed into the dark surface |
| `--mbk-screen-link`        | `#4f7864`     | `#7fae95`                           |
| `--mbk-screen-link-strong` | `#2f5945`     | `#a4c9b3`                           |

These values are the authored fragment's own colors, not the viewer interface,
so they keep their existing Light values and are outside the corrections above.
Each device screen also sets its own CSS `color-scheme`, so native controls and
scrollbars inside a preview follow the preview rather than the interface. Fixed
phone hardware and the browser traffic lights keep their intended colors in both
appearances, and are named so no stylesheet repeats them:

| Role                          | Both appearances        |
| ----------------------------- | ----------------------- |
| `--mbk-device-body`           | `#171a18`               |
| `--mbk-device-notch`          | `#0b0d0c`               |
| `--mbk-device-home`           | `rgba(20, 24, 20, 0.4)` |
| `--mbk-device-light-close`    | `#d9655b`               |
| `--mbk-device-light-minimise` | `#dba43d`               |
| `--mbk-device-light-expand`   | `#50a86d`               |

A comparison in Difference mode paints an opaque base behind the compared
frames, taken from the compared preview scheme, so the blended result is
identical in both appearances.

## Component Explorer Preview Tokens

The component explorer draws a depicted component on its own canvas, inside the
catalogue chrome. Those canvas colours describe the depicted content rather than
the interface, so `design-component-view.css` scopes its own roles to
`.ce-design` and they stay Light in both appearances, exactly as the preview
tokens above do. A stylesheet that needs one of these reads the token rather
than repeating its value.

| Role             | Both appearances   |
| ---------------- | ------------------ |
| `--ce-surface`   | `white`            |
| `--ce-text`      | `#252e28`          |
| `--ce-secondary` | `#647068`          |
| `--ce-soft`      | `#f3f6f3`          |
| `--ce-edge`      | `#dce5de`          |
| `--ce-mask`      | `var(--chrome-bg)` |

`--ce-mask` is the exception: the highlight scrim covers the catalogue around a
depicted component rather than the component itself, so it follows the interface
background. The explorer's own artboards render in Light only, so these roles
have no Dark counterpart; a dark component canvas would need this table extended
before those artboards could publish a dark render.

## Related Docs

- [Viewer appearance](./mokly-viewer-appearance.md)
- [Shell design contract](./mokly-shell-design.md)
