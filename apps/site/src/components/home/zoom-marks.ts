/**
 * The marks of the home's zoom pill: the attributes that the site's markup
 * puts on the parts that the home zoom island finds, and the page root's
 * class and properties that the island sets for `src/styles/home-zoom.css`.
 * `ZoomControl.astro`, `StatusBar.astro`, `Hero.astro`, `Workspace.astro`
 * and `Footer.astro` mark the parts, and `zoom-pill.ts` reads them.
 */
import type { ZoomStep } from "./zoom.js";

/** The mark of the control, the group that holds the buttons and the zoom. */
export const CONTROL = "data-home-zoom";

/** The mark of the depicted pill, which the control replaces. */
export const DEPICTION = "data-home-zoom-depiction";

/**
 * The mark of each part that the zoom scales: the hero, the workspace and
 * the footer frame.
 */
export const PART = "data-home-zoom-part";

/** The mark that names the step of each button. */
export const STEP = "data-home-zoom-step";

/** The mark of the zoom between the buttons, a polite live region. */
export const VALUE = "data-home-zoom-value";

/** The page root's class above 100%, which `home-zoom.css` reads. */
export const ZOOMED_IN_CLASS = "site-root--zoomed-in";

/** The page root's property that holds the zoom above 100%. */
export const ZOOM_PROPERTY = "--home-zoom";

/**
 * The page root's property that holds the height of the window's sideways
 * scrollbar above 100%, which the status bar's clearance gives up.
 */
export const SCROLLBAR_PROPERTY = "--home-scrollbar-height";

/** The attributes that mark the parts that the island finds. */
export const ZOOM_MARKS = {
  control: { [CONTROL]: "" },
  depiction: { [DEPICTION]: "" },
  part: { [PART]: "" },
  value: { [VALUE]: "" },
} as const;

/** The attributes that mark the button of `step`. */
export function zoomStepMark(step: ZoomStep): { readonly [STEP]: ZoomStep } {
  return { [STEP]: step };
}
