/** In-place comparison controls and isolated snapshot panes. */

/** Styles appended to the catalogue shell. */
export const SHELL_REVIEW_CSS = `
.mbk-diff-screen, .mbk-current-screen {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.mbk-diff-screen [hidden] { display: none; }
.mbk-diff-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 24px;
  border-bottom: 1px solid var(--chrome-border);
  background: var(--chrome-surface);
}
.mbk-diff-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--chrome-accent);
  font: inherit;
  font-size: 20px;
  cursor: pointer;
}
.mbk-diff-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background: radial-gradient(circle, rgba(20,28,22,.05) 1px, transparent 1px) 0 0 / 22px 22px;
}
.mbk-diff-view { margin-bottom: 24px; }
.mbk-diff-view h3 {
  margin: 0 0 12px;
  color: var(--chrome-ink-2);
  font-size: 12px;
  font-weight: 600;
}
.mb-panes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  isolation: isolate;
}
.mbk-diff-mobile .mb-panes {
  grid-template-columns: repeat(2, 390px);
}
.mb-pane { min-width: 0; }
.mb-pane-label {
  color: var(--chrome-muted);
  font-size: 12px;
  margin: 0 0 8px;
}
.mb-pane-doc { width: 100%; }
.mb-pane-missing {
  display: grid;
  place-content: center;
  min-height: 240px;
  padding: 20px;
  border: 1px dashed var(--chrome-border-strong);
  border-radius: 12px;
  background: var(--chrome-surface);
  color: var(--chrome-muted);
  text-align: center;
}
.mb-panes[data-compare-mode="overlay"],
.mb-panes[data-compare-mode="difference"] { grid-template-columns: minmax(0, 1fr); }
.mbk-diff-mobile .mb-panes:not([data-compare-mode="side"]) { grid-template-columns: 390px; }
.mb-panes:not([data-compare-mode="side"]) .mb-pane { grid-area: 1 / 1; }
.mb-panes:not([data-compare-mode="side"]) .mb-pane-label { visibility: hidden; }
.mb-panes[data-compare-mode="overlay"] .mb-pane--after { opacity: .5; }
.mb-panes[data-compare-mode="difference"] .mb-pane--after .mb-pane-doc { mix-blend-mode: difference; }
@media (max-width: 56.25rem) {
  .mbk-diff-toolbar { padding: 8px 12px; }
  .mbk-diff-toolbar .mbk-seg { flex: 1; }
  .mbk-diff-toolbar .mbk-seg button { flex: 1; padding: 6px; white-space: nowrap; font-size: 11px; }
  .mbk-diff-stage { padding: 16px; }
  .mb-panes[data-compare-mode="side"],
  .mbk-diff-mobile .mb-panes { grid-template-columns: minmax(0, 1fr); }
  .mbk-diff-mobile .mb-panes:not([data-compare-mode="side"]) { grid-template-columns: minmax(0, 1fr); }
}
`;
