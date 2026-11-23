/**
 * The selectors of the routed entry's frames in Browse. From 900px wide the
 * canvas shows each view in a frame of its own scheme, and a component as
 * rows of desktop frames, its own example first; below that width one frame
 * of each viewport shows the chosen scheme.
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
 * A viewport's frame in either layout: the canvas's Light frame, or the one
 * frame of the narrow stage. A component's set has one in each row.
 */
export function viewFrame(viewport: Viewport): string {
  return `[data-workspace-frame="${viewport}"]:not([data-workspace-color-scheme="dark"])`;
}

/** The frame of a page or a Markdown document in either layout. */
export const DOCUMENT_FRAME = "[data-mokly-stage] iframe";
