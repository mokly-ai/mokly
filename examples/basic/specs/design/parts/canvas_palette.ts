import type { CSSProperties } from "react";

import {
  palettes,
  type PaletteColors,
  type PaletteFonts,
  type PaletteScheme,
} from "../../../../../packages/ui/src/palette/palette.js";

/** The custom properties that a Canvas scope declares, by name. */
export type CanvasProperties = Readonly<Record<`--${string}`, string>>;

/**
 * The Canvas palette as the custom properties of one scope, from the colour
 * roles and the fonts of one scheme of `palettes.canvas`, the only source of
 * a Canvas value. The `--cv-*` roles draw the Canvas parts. The shell tokens
 * that the `@mokly/ui` components read follow, each mapped from a Canvas
 * role, so the package's top bar, catalogue, chips, and panels draw in Canvas
 * without a package change. A token without a Canvas role keeps its value
 * from the shipped theme, or takes a mix of Canvas roles from the shared
 * Canvas stylesheet.
 */
export function canvasProperties(
  colors: PaletteColors,
  fonts: PaletteFonts,
): CanvasProperties {
  return {
    // The canvas behind the frames and the floating panels.
    "--cv-background": colors.background,
    // The dots of the canvas grid.
    "--cv-dot": colors.dot,
    // Frames, panels, the zoom pill, and the dock.
    "--cv-surface": colors.surface,
    // Popovers and raised rows, one step above a surface.
    "--cv-surface-raised": colors.surfaceRaised,
    // Fields, the source box, and panel feet, one step below a surface.
    "--cv-surface-muted": colors.surfaceMuted,
    // Titles, values, and icons.
    "--cv-text": colors.text,
    // Descriptions and secondary values.
    "--cv-text-secondary": colors.textSecondary,
    // Labels, frame labels, size tags, and counts.
    "--cv-text-muted": colors.textMuted,
    // Hairlines between and around surfaces.
    "--cv-border": colors.border,
    // Control edges and meaningful outlines, at 3:1 on every surface.
    "--cv-border-strong": colors.borderStrong,
    // The selected tab's rule and the selection marks.
    "--cv-signal": colors.signal,
    // Text on the signal colour.
    "--cv-on-signal": colors.onSignal,
    // Selected rows and pressed toggles.
    "--cv-signal-soft": colors.signalSoft,
    // Signal text and glyphs, and focus rings.
    "--cv-signal-deep": colors.signalDeep,
    // A filled button.
    "--cv-signal-fill": colors.signalFill,
    // The label of a filled button.
    "--cv-on-signal-fill": colors.onSignalFill,
    // Geist for the interface, and Geist Mono for labels, paths, and sizes.
    "--cv-sans": fonts.sans,
    "--cv-mono": fonts.mono,

    // The shell's page and the search field: the canvas.
    "--chrome-bg": colors.background,
    // Every panel, bar, and card of the shell: a surface.
    "--chrome-surface": colors.surface,
    // The catalogue column, which floats as a panel: a surface.
    "--chrome-raised": colors.surface,
    // Titles and values.
    "--chrome-ink": colors.text,
    // Secondary text.
    "--chrome-ink-2": colors.textSecondary,
    // Labels and quiet text.
    "--chrome-muted": colors.textMuted,
    // Hairlines.
    "--chrome-border": colors.border,
    // Control boundaries.
    "--chrome-control-edge": colors.borderStrong,
    // Links in the shell's text.
    "--chrome-accent": colors.signalDeep,
    // The brand mark.
    "--chrome-brand": colors.signalDeep,
    // The guide lines of the catalogue tree: hairlines.
    "--mbk-guide": colors.border,
    // The dots of the shipped stage grid: the canvas dots.
    "--mbk-dot": colors.dot,
    // The bar of a depicted window: a muted surface.
    "--mbk-browser-bar": colors.surfaceMuted,
    // The accent's text, edges, and focus rings: signal text.
    "--mbk-accent-deep": colors.signalDeep,
    // Selected and added surfaces: the soft signal fill.
    "--mbk-accent-surface": colors.signalSoft,
    // The design catalogue's names for the same accent roles.
    "--mbk-sage": colors.signalDeep,
    "--mbk-sage-deep": colors.signalDeep,
    "--mbk-accent-contrast": colors.surface,
    "--mbk-accent-soft": colors.signalSoft,
    // Added entries: signal text on the soft signal fill.
    "--mb-added": colors.signalDeep,
    "--mb-added-soft": colors.signalSoft,
    // The shell's aliases of the surfaces and text.
    "--mb-bg": colors.background,
    "--mb-surface": colors.surface,
    "--mb-border": colors.border,
    "--mb-text": colors.text,
    "--mb-muted": colors.textMuted,
    "--mb-ignored": colors.textMuted,
    // The public accent and its defaults: signal text, the label on it, and
    // the soft signal fill of a hovered or pressed control.
    "--mokly-accent": colors.signalDeep,
    "--mokly-accent-contrast": colors.surface,
    "--mokly-accent-soft": colors.signalSoft,
    "--_mokly-private-accent-default": colors.signalDeep,
    "--_mokly-private-accent-contrast-default": colors.surface,
    "--_mokly-private-accent-soft-default": colors.signalSoft,
    // Text on an ink fill and on the deep accent.
    "--_mokly-private-on-ink": colors.surface,
    "--_mokly-private-on-accent-deep": colors.surface,
    // Geist for the shell's text, its paths, and its wordmark.
    "--sans": fonts.sans,
    "--mono": fonts.mono,
    "--serif": fonts.sans,
  };
}

/** The scope element's inline style: the Canvas properties of one scheme. */
export function canvasStyle(scheme: PaletteScheme): CSSProperties {
  const style: CSSProperties & CanvasProperties = {
    ...canvasProperties(palettes.canvas[scheme], palettes.canvas.fonts),
  };
  return style;
}

/**
 * The attributes of a Canvas scope's root: the theme's root class, so the
 * reset and the package tokens apply, the Canvas class that the shared
 * Canvas stylesheet reads, the stated appearance, and the Canvas palette.
 */
export function canvasScope(scheme: PaletteScheme) {
  return {
    className: "cv mbk",
    "data-mbk-appearance": scheme,
    "data-mokly-theme": scheme,
    style: canvasStyle(scheme),
  } as const;
}
