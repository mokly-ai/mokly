import { tokens } from "./tokens";
import type { TokenColorScheme } from "./tokens";

/** The default Canvas family or the paper family of Design components. */
export type DocumentPalette = "default" | "paper";

/** The only family that needs a scope class over the document's defaults. */
export const documentPalettes = {
  paper: { roles: "paper", scope: "paper-scope" },
} as const;

/** Bind surface, text and line roles without changing accent or status roles. */
export function paletteColors(
  scheme: TokenColorScheme,
  palette: DocumentPalette = "default",
) {
  const color = tokens.color[scheme];
  if (palette === "paper")
    return {
      background: color.paper,
      surface: color.paperSurface,
      surfaceRaised: color.paperSurface,
      surfaceMuted: color.paperMuted,
      text: color.paperInk,
      textSecondary: color.paperInkMuted,
      textMuted: color.paperInkMuted,
      border: color.paperLine,
      borderStrong: color.paperLineStrong,
    };
  return {
    background: color.background,
    surface: color.surface,
    surfaceRaised: color.surfaceRaised,
    surfaceMuted: color.surfaceMuted,
    text: color.text,
    textSecondary: color.textSecondary,
    textMuted: color.textMuted,
    border: color.border,
    borderStrong: color.borderStrong,
  };
}
