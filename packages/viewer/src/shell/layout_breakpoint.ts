/** The shell's one layout breakpoint, from the device chrome contract. */

/**
 * The media query of a shell narrower than 900px: the catalogue is a drawer
 * and the inspector a bottom sheet. At 900px and wider the catalogue is a
 * persistent column. Every shell and viewer rule and script reads this one
 * query, so they switch at the same width.
 */
export const NARROW_SHELL = "(width < 56.25rem)";
