import type { Palette } from "../src/palette/palette.js";

/** One generated stylesheet: its repository path and its CSS. */
export interface PaletteStylesheet {
  path: string;
  css: string;
}

/** The repository path of the palette module that every stylesheet comes from. */
export const PALETTE_SOURCE: string;

/** The command that writes the generated stylesheets again. */
export const GENERATE_COMMAND: string;

/**
 * The `@mokly/ui` theme: the Light and Dark roles of the shell on the root
 * class and the stub's document class, the preview tokens, and the stub
 * page's own rules.
 */
export function themeStylesheet(palette: Palette): string;

/**
 * The palette part of the `mokly-html` Markdown style: the custom properties
 * of the Light and Dark documents, which the hand-kept typography reads.
 */
export function documentPaletteStylesheet(palette: Palette): string;

/** Every stylesheet that the palette generates, with its repository path. */
export function paletteStylesheets(palette: Palette): PaletteStylesheet[];
