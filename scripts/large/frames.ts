/**
 * The selectors of the routed entry's frames on Browse's canvas. The large
 * checks open Browse 1440px wide, above the layout breakpoint, where a screen
 * shows the view of each viewport in a frame of each scheme, a component its
 * variant set of desktop frames, its own example's row first, and a page or a
 * Markdown document one reading frame.
 */

type Viewport = "desktop" | "mobile";

/** A viewport's frame of one scheme on the canvas. */
export function schemeFrame(
  viewport: Viewport,
  scheme: "dark" | "light",
): string {
  return `[data-workspace-frame="${viewport}"][data-workspace-color-scheme="${scheme}"]`;
}

/**
 * A viewport's Light frame on the canvas. A component's variant set has one
 * in each row, its own example's first.
 */
export function viewFrame(viewport: Viewport): string {
  return schemeFrame(viewport, "light");
}

/** The canvas's reading frame of a page or a Markdown document. */
export const DOCUMENT_FRAME = "[data-mokly-stage] iframe";
