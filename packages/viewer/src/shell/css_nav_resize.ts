/**
 * The shell root while the reader drags the navigation separator: the drag
 * marks the root, or the stub's body, and every element in it follows.
 */

/** Styles for a shell root during a navigation resize. */
export const SHELL_NAV_RESIZE_CSS = `
body.mbk-nav-resizing,
[data-mokly-shell].mbk-nav-resizing {
  cursor: col-resize;
  user-select: none;
}

body.mbk-nav-resizing *,
[data-mokly-shell].mbk-nav-resizing * {
  cursor: col-resize !important;
}

body.mbk-nav-resizing iframe,
[data-mokly-shell].mbk-nav-resizing iframe {
  pointer-events: none;
}
`;
