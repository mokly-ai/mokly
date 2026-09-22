/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_WORKSPACE_MARKS = `
/* Per-view change evidence on the view controls: a 6px accent dot in the
   control's top-right corner, ringed so it stays legible over the icon, and
   the wording a screen reader hears as the control's description. Both are
   hidden until the shown view is not the changed one, so the mark stays
   distinct from the control's pressed state and never draws an edge rail. */
.mbk-view-changed {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mokly-accent);
  box-shadow: 0 0 0 1.5px var(--chrome-surface);
  pointer-events: none;
}

.mbk-icon-button:disabled .mbk-view-changed,
.mbk-icon-select:has(select:disabled) .mbk-view-changed {
  background: var(--chrome-muted);
}

.mbk-view-changed-text {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.mbk-meta-row[hidden] {
  display: none;
}
`;
