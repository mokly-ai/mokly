import {
  createSharedUiTheme,
  darkSharedUiTheme,
  defaultSharedUiTheme,
} from "@firna/ui/theme";
import type {
  SharedUiColors,
  SharedUiScheme,
  SharedUiTheme,
} from "@firna/ui/theme";

import { paletteColors } from "./palettes";
import type { DocumentPalette } from "./palettes";
import { tokens } from "./tokens";

/** Every Firna color comes from the selected token surface family. */
export function sharedUiColors(
  scheme: SharedUiScheme,
  palette: DocumentPalette = "default",
): SharedUiColors {
  const color = tokens.color[scheme];
  const roles = paletteColors(scheme, palette);
  return {
    amber: color.warning,
    amberDeep: color.warning,
    amberSoft: color.warningSoft,
    bg: roles.background,
    bg2: roles.surfaceMuted,
    border: roles.border,
    border2: roles.border,
    controlBorder: roles.borderStrong,
    faint: roles.textMuted,
    ink: roles.text,
    ink2: roles.text,
    muted: roles.textMuted,
    onSolid: color.onAccent,
    placeholder: roles.textMuted,
    primary: color.accentSolid,
    primaryBorder: color.accentSoft,
    primaryDeep: color.accent,
    primarySoft: color.accentSoft,
    rose: color.danger,
    roseDeep: color.danger,
    roseSoft: color.dangerSoft,
    soft: roles.surfaceMuted,
    surface: roles.surface,
  };
}

/**
 * Adapt the token source's pixel radii to Firna's numeric geometry: each is
 * parsed as a number, `xl` and `xxl` both come from `xlarge`, and the avatar
 * ratio is `small / xlarge`.
 */
export const sharedUiRadii = {
  avatarRatio:
    parseFloat(tokens.radius.small) / parseFloat(tokens.radius.xlarge),
  sm: parseFloat(tokens.radius.small),
  md: parseFloat(tokens.radius.medium),
  lg: parseFloat(tokens.radius.large),
  xl: parseFloat(tokens.radius.xlarge),
  xxl: parseFloat(tokens.radius.xlarge),
  pill: parseFloat(tokens.radius.pill),
};

/**
 * Control geometry derived from shared radii. The default family takes
 * the chrome radius for a control and the medium radius for a surface, so a
 * control is 8px and a surface 10px, as the radius contract assigns by
 * component class.
 */
const chromeRadii = {
  sm: parseFloat(tokens.radius.small),
  md: parseFloat(tokens.radius.chrome),
  lg: parseFloat(tokens.radius.medium),
};
const paletteRadii: Record<DocumentPalette, Partial<typeof sharedUiRadii>> = {
  default: chromeRadii,
  paper: {},
};

/**
 * The dark scheme extends the dark preset, including package-owned chart
 * roles; a theme built from the light preset with only `scheme` changed is
 * not a dark theme.
 */
function theme(
  scheme: SharedUiScheme,
  palette: DocumentPalette,
): SharedUiTheme {
  const fonts = tokens.font;
  return createSharedUiTheme(
    {
      colors: sharedUiColors(scheme, palette),
      fonts: { sans: fonts.sans, mono: fonts.mono },
      radii: { ...sharedUiRadii, ...paletteRadii[palette] },
    },
    scheme === "dark" ? darkSharedUiTheme : defaultSharedUiTheme,
  );
}

/** Default Canvas themes shared by the catalogue and the application. */
export const sharedUiThemes = {
  light: theme("light", "default"),
  dark: theme("dark", "default"),
};

/** One document palette's complete control theme: its colors, type and geometry. */
export function paletteUiTheme(
  scheme: SharedUiScheme,
  palette: DocumentPalette = "default",
): SharedUiTheme {
  return palette === "default"
    ? sharedUiThemes[scheme]
    : theme(scheme, palette);
}

/** Static pages need the package's browser-outline fallback without hydration. */
export function staticUiTheme(
  scheme: SharedUiScheme,
  palette: DocumentPalette = "default",
): SharedUiTheme {
  return createSharedUiTheme(
    { focusIndicator: "outline" },
    paletteUiTheme(scheme, palette),
  );
}

/** The editorial header uses the same control with the shared pill radius. */
export function pillUiTheme(base: SharedUiTheme): SharedUiTheme {
  return createSharedUiTheme({ radii: { md: sharedUiRadii.pill } }, base);
}

/** Primary actions keep their resting solid fill on hover. */
export function primaryActionUiTheme(base: SharedUiTheme): SharedUiTheme {
  return createSharedUiTheme(
    { colors: { primaryDeep: base.colors.primary } },
    base,
  );
}

/** The red, green and blue channels of an opaque `#rrggbb` colour. */
function channels(color: string): number[] | undefined {
  if (!/^#[0-9a-f]{6}$/iu.test(color)) return undefined;
  return [1, 3, 5].map((start) =>
    Number.parseInt(color.slice(start, start + 2), 16),
  );
}

/**
 * `percent` of the opaque `front` over the opaque `back`, mixed in sRGB as
 * `color-mix(in srgb, …)` mixes, with each channel rounded. A colour that is
 * not `#rrggbb` leaves `back` unchanged.
 */
function mixed(front: string, percent: number, back: string): string {
  const over = channels(front);
  const under = channels(back);
  if (over === undefined || under === undefined) return back;
  return (
    "#" +
    over
      .map((value, index) =>
        Math.round(
          (value * percent + (under[index] ?? 0) * (100 - percent)) / 100,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * A quiet Button that stands on the muted surface, such as the publication
 * pill's. The library draws a plain Button's hover and press washes in `soft`
 * and `bg2`, which the mapping binds to that same surface, so they show
 * nothing there. This theme makes them the ink at 5% and at 7% over it: a
 * hover fill of the Folio chrome rule, and a press one step deeper that keeps
 * muted text at 4.5:1. Other colors, fonts and radii stay unchanged.
 */
export function quietOnMutedUiTheme(base: SharedUiTheme): SharedUiTheme {
  const { ink, soft } = base.colors;
  return createSharedUiTheme(
    { colors: { soft: mixed(ink, 5, soft), bg2: mixed(ink, 7, soft) } },
    base,
  );
}
