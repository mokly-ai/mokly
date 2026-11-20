# Tokens Package

`@mokly-cloud/tokens` is the single source of Mokly Cloud's visual values: the
typed light and dark token tables, the surface families a document binds them
to, the CSS custom properties generated from them, and the `@firna/ui` control
theme derived from the same values. The generated catalogue, application and
static site import it, so a color, radius or control geometry cannot drift
between specification and product. It is a private npm workspace dependency, not
a separately published package. The canvas palette is the one family whose
values live elsewhere: it binds the Canvas palette of the open-source
`@mokly/ui` package, and only the design mockups select it.

The contract these values satisfy is
[Design tokens](../../docs/protocol/cloud/design-tokens.md) with its
[color tables](../../docs/protocol/cloud/design-tokens-color.md).

## Responsibilities

- Hold the typed token tables: the colors of both schemes, the fonts, the type
  ramp, space, radii, shadows, layout and motion.
- Bind the semantic color roles to one surface family, paper, Folio or canvas,
  and name the scope class a document carries for it.
- Emit the `--mk-*` custom properties: one viewport baked for a generated
  document, with the canvas scope for a canvas document, or both type ramps
  under the shared breakpoint for a running surface.
- Derive the `@firna/ui` theme of a scheme and a document palette, with its
  static and header-pill variants.

The package ships no stylesheet: the Folio stylesheets live under
`docs/mockups/styles` and read these properties, and `fonts/geist.css` there
loads the Geist faces that the canvas fonts name. No consumer keeps a copy of
a value, and no stylesheet declares a token.

## What This Package Does

| Entry point                           | Owns                                                    |
| ------------------------------------- | ------------------------------------------------------- |
| `@mokly-cloud/tokens/tokens`          | `tokens`: colors, type, space, radius, shadow, layout   |
| `@mokly-cloud/tokens/palettes`        | Surface families, scope classes, colors and fonts       |
| `@mokly-cloud/tokens/token-css`       | `tokenCss` for one generated view, `responsiveTokenCss` |
| `@mokly-cloud/tokens/shared-ui-theme` | The Firna theme mapping, palette and static variants    |

`tokenCss(scheme, viewport, palette?)` bakes one viewport's type ramp, which
is what a generated document needs. Every document carries the paper and Folio
scope rules. Only a document that passes the canvas palette also carries the
canvas scope rule: the Canvas surfaces, the accent roles bound to the signal
green, the Canvas roles that the token table has no name for, such as
`--mk-color-dot`, `--mk-color-signal-fill` and `--mk-color-people-pink-fill`,
and the Geist stacks of `--mk-font-sans`, `--mk-font-mono` and
`--mk-font-display`. `responsiveTokenCss(scheme, selector?)` carries the
desktop ramp with the mobile ramp under the shared breakpoint, and no canvas
scope. Running app code omits the selector; the static site supplies one to
compose system and explicit light/dark rules.

### Control Theme Mapping

`sharedUiColors(scheme, palette)` supplies every Firna color role from the
token table of its scheme. The surface roles come from the selected family,
shown here with the paper template; substitute `folio` for the prefix:

| SharedUiColors keys            | Token source      |
| ------------------------------ | ----------------- |
| `bg`                           | `paper`           |
| `bg2`, `soft`                  | `paperMuted`      |
| `surface`                      | `paperSurface`    |
| `border`, `border2`            | `paperLine`       |
| `controlBorder`                | `paperLineStrong` |
| `faint`                        | `paperInkMuted`   |
| `ink`, `ink2`                  | `paperInk`        |
| `muted`, `placeholder`         | `paperInkMuted`   |
| `onSolid`                      | `onAccent`        |
| `primary`                      | `accentSolid`     |
| `primaryDeep`                  | `accent`          |
| `primarySoft`, `primaryBorder` | `accentSoft`      |
| `amber`, `amberDeep`           | `warning`         |
| `amberSoft`                    | `warningSoft`     |
| `rose`, `roseDeep`             | `danger`          |
| `roseSoft`                     | `dangerSoft`      |

`primary` is the library's solid fill and `primaryDeep` its accent ink, which
is why they take `accentSolid` and `accent`; the ghost pressed wash is
`primaryBorder`, so that role stays on the soft tint rather than a heavier line
color. Fonts copy the font tokens. Radii are the pixel radius tokens parsed as
numbers — `sm` from `small`, `md` from `medium`, `lg` from `large`, `xl` and
`xxl` from `xlarge`, `pill` from `pill`, and `avatarRatio` is `small / xlarge`
(0.25) — and the Folio and canvas palettes take `md` from `chrome` and `lg`
from `medium` instead, so a control is 8px and a surface 10px.

The canvas palette maps the same keys from the Canvas palette of `@mokly/ui`
instead of the token table: each surface row from the Canvas role of the same
meaning, such as `bg` from `background` and `controlBorder` from
`borderStrong`, and the accent rows from the signal roles, so `primary` takes
`signalFill`, `onSolid` takes `onSignalFill`, `primaryDeep` takes
`signalDeep`, and `primarySoft` and `primaryBorder` take `signalSoft`. The
status rows keep the token table, and the fonts are the palette's Geist
stacks. A catalogue policy test holds this mapping beside the table's.

The header pill theme sets
only `md` to the pill radius. Live themes keep `focusIndicator: "ring"`; the
static document theme sets `"outline"`, which keeps the browser's
keyboard-focus outline without hydration.

## Quick Start

```ts
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { responsiveTokenCss } from "@mokly-cloud/tokens/token-css";
import { tokens } from "@mokly-cloud/tokens/tokens";

document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: responsiveTokenCss("light"),
  }),
);
const theme = paletteUiTheme("light", "folio");
const gutter = tokens.layout.gutterDesktop;
```

## Development

```sh
npm ci
npm run typecheck --workspace @mokly-cloud/tokens
```

The package ships TypeScript sources; its consumers bundle them. It extends
the theme of the exact-pinned `@firna/ui` 4.0.0, and it reads the Canvas
palette from the built `@mokly/ui` of the workspace, so run `npm run build`
before a consumer bundles it. Changing a value here changes the catalogue, app
and site, so update
[Design tokens](../../docs/protocol/cloud/design-tokens.md) and regenerate the
mockups in the same change. The mapping table above is read by a catalogue
policy test, so keep it in step with the theme module.

### Key Code

- `src/tokens.ts` — `tokens`, the typed light and dark color tables, fonts, type ramp, space, radii, shadows, layout and motion, with the `TokenColorScheme` and `TokenViewport` unions.
- `src/palettes.ts` — `paletteColors(scheme, family)` binds the semantic color roles to one surface family, the canvas family from the Canvas palette of `@mokly/ui/palette`; `canvasColors(scheme)` gives the accent and Canvas roles that the canvas scope adds, `paletteFonts(family)` the font stacks of a family, and `documentPalettes` maps each document palette to its roles and scope class, such as `folio-scope`; the app's theme provider and the generated emails bind the Folio roles through it.
- `src/token-css.ts` — `tokenCss(scheme, viewport, palette?)` emits the `:root` custom properties and the scope rules for one generated viewport, with the canvas scope only for a canvas document; `responsiveTokenCss(scheme, selector?)` emits the desktop ramp with the mobile ramp under the breakpoint, scoped under the selector when the caller gives one.
- `src/shared-ui-theme.ts` — `sharedUiColors` and `sharedUiRadii` map the tokens, or the Canvas palette for the canvas family, onto Firna's roles; `sharedUiThemes` are the paper themes, `paletteUiTheme(scheme, palette)` the complete theme of one document palette, `staticUiTheme` the same with `focusIndicator: "outline"`, and `pillUiTheme` the header pill variant.

### Related Docs

- [Architecture](../../docs/architecture/cloud.md) — the design system component and its consumers.
- [Design tokens](../../docs/protocol/cloud/design-tokens.md) and [Design token colors](../../docs/protocol/cloud/design-tokens-color.md)
- [Shared controls](../../docs/protocol/cloud/shared-controls.md)
- [Folio chrome](../../docs/protocol/cloud/folio-chrome.md)
- [npm workspace guide](../../apps/README.md)
