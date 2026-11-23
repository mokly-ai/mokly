/**
 * The shell's layout breakpoint and panel step, from the canvas frames
 * contract. The `@mokly/ui` stylesheets repeat these queries, and the
 * viewer's styles test holds them to this module.
 */

/**
 * The media query of a shell narrower than 900px, the compact layout: one
 * frame on the canvas, the dock, and the catalogue and the right panel as
 * sheets. At 900px and wider the panels float over the canvas. Every shell
 * and viewer rule and script reads this one query, so they switch at the
 * same width.
 */
export const NARROW_SHELL = "(width < 56.25rem)";

/**
 * The media query of the panel step: narrower than 1180px, the floating
 * catalogue starts 224px wide and the right panel is 284px, in place of
 * 252px and 312px.
 */
export const NARROW_PANELS = "(width < 73.75rem)";
