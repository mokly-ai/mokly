# Tokens Package

`@mokly-cloud/tokens` owns Mokly Cloud's typed visual tokens, surface families,
CSS custom properties and `@firna/ui` control themes. The catalogue, application
and static site import this private npm workspace package. Canvas is the default
family. Its shared colors and sans and mono font stacks come from
`@mokly/ui/palette`, with no copied values. The package owns the focus, status,
paper, art and window colors, the display serif, and the other token tables.

The contract is [Design tokens](../../docs/protocol/cloud/design-tokens.md)
with its [color tables](../../docs/protocol/cloud/design-tokens-color.md).

## Responsibilities

- Hold the typed tokens for both schemes, type, space, radii, shadows, layout
  and motion.
- Bind semantic surface, text and line roles to the default Canvas family or
  the paper family of Design components.
- Emit every `--mk-*` property on the document root, or the caller's selector,
  with the paper scope rule.
- Derive live, static, primary-action and header-pill control themes from the same tokens.

The package ships no stylesheet. The styles under `docs/mockups/styles` use
its properties. Each surface loads its own self-hosted Geist and Geist Mono.
No consumer copies a value, and no stylesheet declares a token.

## What This Package Does

| Entry point                           | Owns                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| `@mokly-cloud/tokens/tokens`          | `tokens`, `TokenColorScheme` and `TokenViewport`                   |
| `@mokly-cloud/tokens/palettes`        | `DocumentPalette`, `documentPalettes`, `paletteColors`             |
| `@mokly-cloud/tokens/token-css`       | `cssVariables`, `tokenCss`, `responsiveTokenCss`                   |
| `@mokly-cloud/tokens/shared-ui-theme` | Firna mapping and theme variants, including `primaryActionUiTheme` |

`DocumentPalette` is `"default" | "paper"`. `paletteColors(scheme, palette?)`
returns the surface, text and line roles. Omitting the family selects Canvas.
`documentPalettes.paper` names the `paper-scope` class. This scope changes only
the surface, text and line roles. Accent, status, focus and font tokens stay
shared. `font.display` stays `Georgia, "Times New Roman", serif`.

`tokenCss(scheme, viewport)` emits every token on `:root` and bakes one
viewport's type ramp. `responsiveTokenCss(scheme, selector?)` emits the same
tokens with the desktop ramp, then the mobile ramp below the shared breakpoint.
Both emit `.paper-scope`. The scoped responsive output qualifies that rule
with the caller's selector. Running app code omits the selector. The static
site supplies one to compose system and explicit light/dark rules.

### Control Theme Mapping

`sharedUiColors(scheme, palette?)` supplies every Firna color role from the
scheme's token table. The default family uses this mapping. The paper family
rebinds the semantic surface, text and line roles before the same mapping.

| SharedUiColors keys            | Token source   |
| ------------------------------ | -------------- |
| `bg`                           | `background`   |
| `bg2`, `soft`                  | `surfaceMuted` |
| `surface`                      | `surface`      |
| `border`, `border2`            | `border`       |
| `controlBorder`                | `borderStrong` |
| `faint`                        | `textMuted`    |
| `ink`, `ink2`                  | `text`         |
| `muted`, `placeholder`         | `textMuted`    |
| `onSolid`                      | `onAccent`     |
| `primary`                      | `accentSolid`  |
| `primaryDeep`                  | `accent`       |
| `primarySoft`, `primaryBorder` | `accentSoft`   |
| `amber`, `amberDeep`           | `warning`      |
| `amberSoft`                    | `warningSoft`  |
| `rose`, `roseDeep`             | `danger`       |
| `roseSoft`                     | `dangerSoft`   |

`primary` is the solid fill and `primaryDeep` is accent ink. The ghost pressed
wash is `primaryBorder`, so it takes the soft tint. Both schemes use the same
green fill and white `onSolid` label. Fonts use `font.sans` and `font.mono`.

`primaryActionUiTheme(base: SharedUiTheme): SharedUiTheme` scopes a primary
Button to a constant fill. It sets only `primaryDeep` to the base theme's
`primary`, so resting and hovered primary actions keep the same green fill
and white label in both schemes. Other colors, fonts and radii stay unchanged.
The base theme keeps `primaryDeep` as accent ink for ghost labels and soft
badges. Product code draws no solid Firna badge because its dark fills cannot
support the white label at 4.5:1.

`sharedUiRadii` parses the pixel radius tokens as numbers. It maps `sm` from
`small`, `md` from `medium`, `lg` from `large`, `xl` and `xxl` from `xlarge`,
and `pill` from `pill`. `avatarRatio` is `small / xlarge`, or 0.25. The paper
theme uses these radii. The default theme replaces `md` with `chrome` and `lg`
with `medium`, so a control is 8px and a surface is 10px.

`sharedUiThemes.light` and `.dark` are the default Canvas themes.
`paletteUiTheme(scheme, palette?)` returns the selected family's complete live
theme. Live themes keep `focusIndicator: "ring"`. `staticUiTheme(scheme,
palette?)` sets `"outline"` for unhydrated documents. `pillUiTheme(base)`
changes only `md` to the pill radius. Each dark theme extends Firna's dark
preset, so package-owned dark roles stay intact.

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
const theme = paletteUiTheme("light");
const gutter = tokens.layout.gutterDesktop;
```

## Development

```sh
npm ci
npm run typecheck --workspace @mokly-cloud/tokens
```

The package ships TypeScript sources for consumers to bundle. It extends the
exact-pinned `@firna/ui` 4.0.0 and imports the built workspace `@mokly/ui`
palette. Run `npm run build` before a consumer bundles it. Keep the mapping
table above aligned with the theme module. The catalogue policy test reads it.

### Key Code

- `src/tokens.ts` — `tokens` imports Canvas values and font stacks, adds semantic accent names, and holds the token-owned tables.
- `src/palettes.ts` — `DocumentPalette`, `documentPalettes` and `paletteColors` select default Canvas or paper surface roles.
- `src/token-css.ts` — `cssVariables` flattens token trees, including people colors. `tokenCss` and `responsiveTokenCss` emit root tokens and the paper scope.
- `src/shared-ui-theme.ts` — `sharedUiColors`, `sharedUiRadii`, `sharedUiThemes`, `paletteUiTheme`, `staticUiTheme` and `pillUiTheme` derive the Firna themes. `primaryActionUiTheme` keeps a primary Button's hover fill equal to its resting fill.

### Related Docs

- [Architecture](../../docs/architecture/cloud.md)
- [Design tokens](../../docs/protocol/cloud/design-tokens.md) and [Design token colors](../../docs/protocol/cloud/design-tokens-color.md)
- [Viewer palette](../../docs/protocol/mokly-viewer-palette.md#canvas-palette)
- [Shared controls](../../docs/protocol/cloud/shared-controls.md)
- [npm workspace guide](../../apps/README.md)
