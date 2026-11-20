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

import {
  canvasColors,
  documentPalettes,
  paletteColors,
  paletteFonts,
} from "./palettes";
import type { DocumentPalette, PaletteRoles } from "./palettes";
import { tokens } from "./tokens";

/**
 * Every Firna color comes from the matching canonical surface family. The
 * canvas family also takes its accent roles from the Canvas palette, so its
 * solid fill is the signal green of a filled button.
 */
export function sharedUiColors(
  scheme: SharedUiScheme,
  palette: PaletteRoles = "paper",
): SharedUiColors {
  const color =
    palette === "canvas"
      ? { ...tokens.color[scheme], ...canvasColors(scheme) }
      : tokens.color[scheme];
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
 * Control geometry derived from shared radii. The Folio and canvas scopes take
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
  default: {},
  paper: {},
  folio: chromeRadii,
  canvas: chromeRadii,
};

/**
 * The dark scheme extends the dark preset, including package-owned chart
 * roles; a theme built from the light preset with only `scheme` changed is
 * not a dark theme.
 */
function theme(scheme: SharedUiScheme, palette: PaletteRoles): SharedUiTheme {
  const fonts = paletteFonts(palette);
  return createSharedUiTheme(
    {
      colors: sharedUiColors(scheme, palette),
      fonts: { sans: fonts.sans, mono: fonts.mono },
      radii: sharedUiRadii,
    },
    scheme === "dark" ? darkSharedUiTheme : defaultSharedUiTheme,
  );
}

/** Shared mapping for mockups and the future product app. */
export const sharedUiThemes = {
  light: theme("light", "paper"),
  dark: theme("dark", "paper"),
};

/** One document palette's complete control theme: its colors, type and geometry. */
export function paletteUiTheme(
  scheme: SharedUiScheme,
  palette: DocumentPalette,
): SharedUiTheme {
  const roles =
    palette === "default" ? "paper" : documentPalettes[palette].roles;
  return createSharedUiTheme(
    { radii: paletteRadii[palette] },
    roles === "paper" ? sharedUiThemes[scheme] : theme(scheme, roles),
  );
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
