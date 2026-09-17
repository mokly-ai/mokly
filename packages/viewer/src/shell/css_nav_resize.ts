/** Desktop navigation resize affordance and interaction states. */

/** Styles for the navigation split-panel separator. */
export const SHELL_NAV_RESIZE_CSS = `
.mbk-nav-resize {
  position: absolute;
  z-index: 2;
  top: 0;
  right: -4px;
  bottom: 0;
  display: none;
  width: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  outline: none;
  touch-action: none;
}

.mbk-nav[data-resize-ready] .mbk-nav-resize {
  display: block;
}

.mbk-nav-resize::after {
  content: "";
  position: absolute;
  top: calc(50% - 16px);
  left: 3px;
  width: 2px;
  height: 32px;
  border-radius: 999px;
  background: var(--chrome-border-strong);
  transition: background 120ms ease, box-shadow 120ms ease;
}

.mbk-nav-resize:hover::after,
.mbk-nav-resize:focus-visible::after,
body.mbk-nav-resizing .mbk-nav-resize::after {
  background: var(--mokly-accent);
  box-shadow: 0 0 0 3px var(--mokly-accent-soft);
}

.mbk-nav-resize:focus-visible {
  box-shadow: inset -2px 0 0 var(--mokly-accent);
}

body.mbk-nav-resizing {
  cursor: col-resize;
  user-select: none;
}

body.mbk-nav-resizing * {
  cursor: col-resize !important;
}

body.mbk-nav-resizing iframe {
  pointer-events: none;
}

@media (max-width: 56.25rem) {
  .mbk-nav[data-resize-ready] .mbk-nav-resize {
    display: none;
  }
}
`;
