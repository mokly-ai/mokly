import { palettes } from "@mokly/ui/palette";

import { tokens } from "./tokens";
import type { TokenColorScheme } from "./tokens";

/** Surface families a document can bind the shared semantic roles to. */
export type PaletteRoles = "paper" | "folio" | "canvas";

/** The visual system one generated document uses end to end. */
export type DocumentPalette = "default" | "paper" | "folio" | "canvas";

/** The surface families whose values live in the token table. */
const roleSources = {
  paper: {
    base: "paper",
    muted: "paperMuted",
    surface: "paperSurface",
    ink: "paperInk",
    inkMuted: "paperInkMuted",
    line: "paperLine",
    lineStrong: "paperLineStrong",
  },
  folio: {
    base: "folio",
    muted: "folioMuted",
    surface: "folioSurface",
    ink: "folioInk",
    inkMuted: "folioInkMuted",
    line: "folioLine",
    lineStrong: "folioLineStrong",
  },
} as const satisfies Record<
  Exclude<PaletteRoles, "canvas">,
  Record<string, keyof typeof tokens.color.light>
>;

/** Which surface family and scope class each document palette selects. */
export const documentPalettes = {
  paper: { roles: "paper", scope: "paper-scope" },
  folio: { roles: "folio", scope: "folio-scope" },
  canvas: { roles: "canvas", scope: "canvas-scope" },
} as const satisfies Record<
  Exclude<DocumentPalette, "default">,
  { roles: PaletteRoles; scope: string }
>;

/**
 * Bind the shared semantic color roles to one surface family. The canvas
 * family takes them from the Canvas palette of `@mokly/ui`, whose roles of
 * the same names it binds one to one.
 */
export function paletteColors(scheme: TokenColorScheme, palette: PaletteRoles) {
  if (palette === "canvas") {
    const canvas = palettes.canvas[scheme];
    return {
      background: canvas.background,
      surface: canvas.surface,
      surfaceRaised: canvas.surfaceRaised,
      surfaceMuted: canvas.surfaceMuted,
      text: canvas.text,
      textMuted: canvas.textMuted,
      border: canvas.border,
      borderStrong: canvas.borderStrong,
    };
  }
  const color = tokens.color[scheme];
  const source = roleSources[palette];
  return {
    background: color[source.base],
    surface: color[source.surface],
    surfaceRaised: color[source.surface],
    surfaceMuted: color[source.muted],
    text: color[source.ink],
    textMuted: color[source.inkMuted],
    border: color[source.line],
    borderStrong: color[source.lineStrong],
  };
}

/**
 * The roles that a canvas document sets beside its surfaces: the accent
 * roles, bound to the signal green, and the Canvas roles that the shared
 * table has no name for. Canvas has no separate hover or pressed ink, so
 * both accent states keep the accent ink.
 */
export function canvasColors(scheme: TokenColorScheme) {
  const canvas = palettes.canvas[scheme];
  return {
    accent: canvas.signalDeep,
    accentHover: canvas.signalDeep,
    accentActive: canvas.signalDeep,
    accentSolid: canvas.signalFill,
    onAccent: canvas.onSignalFill,
    accentSoft: canvas.signalSoft,
    textSecondary: canvas.textSecondary,
    dot: canvas.dot,
    signal: canvas.signal,
    onSignal: canvas.onSignal,
    signalSoft: canvas.signalSoft,
    signalDeep: canvas.signalDeep,
    signalFill: canvas.signalFill,
    onSignalFill: canvas.onSignalFill,
    people: canvas.people,
  };
}

/**
 * The font stacks of one surface family: the shared token fonts, or the
 * Canvas palette's Geist and Geist Mono, whose sans face also sets display
 * type.
 */
export function paletteFonts(palette: PaletteRoles) {
  if (palette !== "canvas")
    return {
      sans: tokens.font.sans,
      mono: tokens.font.mono,
      display: tokens.font.display,
    };
  const { sans, mono } = palettes.canvas.fonts;
  return { sans, mono, display: sans };
}
