/** Desktop inspector resize affordance and interaction states. */

/** Styles for the inspector split-panel separator, rotated from the navigation
 * separator so both dividers share one resting, hover, focus and active look.
 *
 * The offset measures from the inspector's padding box, so it clears the 1px
 * top border as well as half the handle, leaving the grip centred on that
 * border. */
export const SHELL_INSPECTOR_RESIZE_CSS = `
.mbk-inspector-resize {
  position: absolute;
  z-index: 2;
  top: -8.5px;
  right: 0;
  left: 0;
  display: none;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: row-resize;
  outline: none;
  touch-action: none;
}

.mbk-inspector[data-open="true"] .mbk-inspector-resize {
  display: block;
}

.mbk-inspector-resize::after {
  content: "";
  position: absolute;
  top: 7px;
  left: calc(50% - 16px);
  width: 32px;
  height: 2px;
  border-radius: 999px;
  background: var(--chrome-border-strong);
  transition: background 120ms ease, box-shadow 120ms ease;
}

.mbk-inspector-resize:hover::after,
.mbk-inspector-resize:focus-visible::after,
[data-mokly-shell].mbk-inspector-resizing .mbk-inspector-resize::after {
  background: var(--mokly-accent);
  box-shadow: 0 0 0 3px var(--mokly-accent-soft);
}

.mbk-inspector-resize:focus-visible {
  box-shadow: inset 0 2px 0 var(--mokly-accent);
}

[data-mokly-shell].mbk-inspector-resizing {
  cursor: row-resize;
  user-select: none;
}

[data-mokly-shell].mbk-inspector-resizing * {
  cursor: row-resize !important;
}

[data-mokly-shell].mbk-inspector-resizing iframe {
  pointer-events: none;
}

@media (max-width: 56.25rem) {
  .mbk-inspector[data-open="true"] .mbk-inspector-resize {
    display: none;
  }
}
`;
