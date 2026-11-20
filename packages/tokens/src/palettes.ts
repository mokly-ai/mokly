import { tokens } from "./tokens";
import type { TokenColorScheme } from "./tokens";

/** Surface families a document can bind the shared semantic roles to. */
export type PaletteRoles = "paper" | "folio";

/** The visual system one generated document uses end to end. */
export type DocumentPalette = "default" | "paper" | "folio";

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
  PaletteRoles,
  Record<string, keyof typeof tokens.color.light>
>;

/** Which surface family and scope class each document palette selects. */
export const documentPalettes = {
  paper: { roles: "paper", scope: "paper-scope" },
  folio: { roles: "folio", scope: "folio-scope" },
} as const satisfies Record<
  Exclude<DocumentPalette, "default">,
  { roles: PaletteRoles; scope: string }
>;

/** Bind the shared semantic color roles to one surface family. */
export function paletteColors(scheme: TokenColorScheme, palette: PaletteRoles) {
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
