/** The shell's layout and device breakpoints, from the device chrome contract. */

/**
 * The media query of a shell narrower than 900px: the catalogue is a drawer
 * and the inspector a bottom sheet. At 900px and wider the catalogue is a
 * persistent column. Every shell and viewer rule and script reads this one
 * query, so they switch at the same width.
 */
export const NARROW_SHELL = "(width < 56.25rem)";

/**
 * The media query of the device breakpoint: at most 760px wide, the shell
 * lays out for phones. The `@mokly/ui` stylesheets repeat both queries, and
 * the viewer's styles test holds them to this module.
 */
export const NARROW_LAYOUT = "(max-width: 760px)";
