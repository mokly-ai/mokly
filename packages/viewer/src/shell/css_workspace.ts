/** Bounded preview/inspector panes and grouped, aligned view controls. */
export const SHELL_WORKSPACE_CSS = `
.mbk-workspace {
  display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden;
}
.mbk:has(.mbk-workspace) .mbk-topbar [data-mokly-schemeswitch] { display: none; }
.mbk-workspace [hidden] { display: none !important; }
.mbk-workspace .mbk-screen-head { align-items: center; }
.mbk-view-tools { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.mbk-icon-button, .mbk-icon-select {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  flex: none; gap: 5px; width: 34px; height: 34px; padding: 0; border: 1px solid transparent;
  border-radius: 7px; background: transparent; color: var(--chrome-ink-2); cursor: pointer;
}
.mbk-icon-button svg, .mbk-icon-select svg { display: block; flex: none; }
.mbk-icon-select { width: 48px; }
.mbk-icon-select svg:last-of-type { width: 12px; }
.mbk-icon-select select { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
.mbk-icon-button:hover, .mbk-icon-select:hover { background: var(--chrome-bg); }
.mbk-icon-button:focus-visible, .mbk-icon-select:focus-within, .mbk-inspector-resize:focus-visible {
  outline: 2px solid var(--mokly-accent); outline-offset: 2px;
}
.mbk-icon-button[aria-selected="true"], .mbk-icon-button[aria-pressed="true"] {
  color: var(--mokly-accent); background: var(--mokly-accent-soft); border-color: var(--chrome-border);
}
.mbk-icon-button:disabled { opacity: .42; cursor: default; }
.mbk-selection-bar {
  display: flex; align-items: center; flex: none; gap: 12px; padding: 8px 24px;
  background: var(--chrome-surface); border-bottom: 1px solid var(--chrome-border); font-size: 12px;
}
.mbk-selection-bar:has(> [hidden]:only-child) { display: none; }
.mbk-selection-bar label { display: flex; align-items: center; gap: 10px; color: var(--chrome-muted); }
.mbk-selection-bar select, .mbk-inspector select {
  background: var(--chrome-surface); color: var(--chrome-ink); border: 1px solid var(--chrome-border); border-radius: 6px; padding: 6px 28px 6px 8px; font: inherit;
}
.mbk-entry-status { border: 1px solid var(--chrome-border); border-radius: 5px; padding: 3px 7px; font-weight: 600; color: var(--chrome-ink-2); }
.mbk-entry-status[data-status="Added"] { color: #246343; background: #e6f3ea; }
.mbk-entry-status[data-status="Changed"] { color: #745316; background: #faf1d8; }
.mbk-entry-status[data-status="Removed"] { color: #873a35; background: #fae9e7; }
.mbk-variant-status { color: var(--chrome-muted); }
.mbk-selection-error { margin: 0; padding: 10px 24px; color: var(--chrome-ink); }
.mbk-workspace-panes { display: flex; flex: 1; flex-direction: column; position: relative; min-height: 0; min-width: 0; }
.mbk-preview-pane { display: flex; flex: 1; flex-direction: column; min-height: 100px; min-width: 0; overflow: hidden; }
.mbk-inspector { position: relative; flex: none; display: flex; flex-direction: column; min-height: 45px; background: var(--chrome-surface); border-top: 1px solid var(--chrome-border); z-index: 5; }
.mbk-inspector[data-open="true"] { height: var(--inspector-height, 260px); max-height: calc(100% - 100px); }
.mbk-inspector-tabs { display: flex; align-items: center; flex: none; gap: 5px; height: 45px; padding: 5px 16px; }
.mbk-inspector-title { font-size: 12px; font-weight: 600; margin-left: 6px; flex: 1; }
.mbk-inspector-content { min-height: 0; flex: 1; overflow: auto; overscroll-behavior: contain; font-size: 13px; }
.mbk-inspector-content > section { padding: 10px 24px 24px; }
.mbk-inspector-content .mbk-details-body { padding: 0; }
.mbk-inspector-content h3 { font-size: 13px; margin: 0 0 12px; }
.mbk-inspector-content p { line-height: 1.5; }
.mbk-inspector-content a { color: var(--mokly-accent); }
.mbk-inspector-resize { position: absolute; top: -8.5px; left: 0; right: 0; height: 16px; cursor: row-resize; touch-action: none; z-index: 2; }
.mbk-inspector-resize::after { content: ''; position: absolute; width: 42px; height: 3px; border-radius: 9px; background: var(--chrome-muted); left: 50%; top: 6.5px; transform: translateX(-50%); }
.mbk-inspector:not([data-open="true"]) .mbk-inspector-resize { display: none; }
.mbk-sheet-grab { display: none; }
.mbk-component-stage { align-items: flex-start; overflow: auto; }
.mbk-component-canvas { flex: none; }
.mbk-component-canvas.mbk-frame-mobile { width: 390px; }
.mbk-component-canvas.mbk-frame-desktop { width: 1024px; }
.mbk-component-canvas iframe { width: 100%; height: 520px; display: block; border: 1px solid var(--chrome-border); border-radius: 8px; background: white; }
.mbk-workspace [data-mokly-stage][data-viewport="mobile"] .mbk-frame-desktop,
.mbk-workspace [data-mokly-stage][data-viewport="desktop"] .mbk-frame-mobile { display: none; }
.mbk-diff-screen[data-diff-component] .mb-pane-doc iframe { width: 100%; min-width: 390px; height: 520px; border: 1px solid var(--chrome-border); background: white; }
.mbk-instance-context { display: inline-block; margin: 0 8px 12px 0; }
.mbk-instance-tree, .mbk-usage-list { list-style: none; padding: 0; margin: 0; }
.mbk-instance-tree .mbk-instance-tree { padding-left: 20px; border-left: 1px solid var(--chrome-border); }
.mbk-instance-tree li { padding: 3px 0; }
.mbk-instance-tree summary { cursor: pointer; color: var(--chrome-muted); font-size: 12px; padding: 4px 0; }
.mbk-instance-select { border: 1px solid transparent; border-radius: 5px; background: transparent; padding: 6px 8px; color: var(--chrome-ink); text-align: left; cursor: pointer; font: inherit; }
.mbk-instance-select[aria-pressed="true"] { background: var(--mokly-accent-soft); color: var(--mokly-accent); border-color: var(--chrome-border); }
.mbk-props-table { width: 100%; border-collapse: collapse; text-align: left; }
.mbk-props-table td, .mbk-props-table th { border-bottom: 1px solid var(--chrome-border); padding: 8px; vertical-align: top; }
.mbk-props-table th { width: 130px; font-size: 12px; }
.mbk-props-table pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; font-size: 12px; }
.mbk-usage-list li { padding: 8px 0; border-bottom: 1px solid var(--chrome-border); }
.mbk-usage-list small { display: block; margin-top: 4px; color: var(--chrome-muted); }
.mbk-comparison-evidence { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--chrome-border); }
.mbk-comparison-evidence p, .mbk-comparison-evidence ul { margin: 8px 0 0; }
.mbk-comparison-evidence ul + p { margin-top: 14px; }
.mbk-highlight-layer { position: fixed; pointer-events: none; z-index: 4; overflow: hidden; }
.mbk-highlight-layer svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.mbk-highlight-label { position: absolute; pointer-events: auto; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0; border-radius: 4px; background: #336249; color: white; padding: 3px 7px; font: 11px var(--sans); cursor: pointer; }
.mbk-control-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px 24px; }
.mbk-control-field { display: flex; flex-direction: column; gap: 6px; position: relative; min-width: 0; }
.mbk-control-field > label:not(.mbk-control-supplied) { font-size: 12px; font-weight: 600; }
.mbk-control-field input:not([type=checkbox]), .mbk-control-field select { min-width: 0; width: 100%; padding: 8px 10px; font: inherit; color: var(--chrome-ink); border: 1px solid var(--chrome-border); border-radius: 6px; background: var(--chrome-surface); }
.mbk-control-field input[type=checkbox] { align-self: start; accent-color: var(--mokly-accent); width: 16px; height: 16px; }
.mbk-control-field [aria-invalid=true] { border-color: #a33737; }
.mbk-control-field input:focus-visible, .mbk-control-field select:focus-visible { outline: 2px solid var(--mokly-accent); outline-offset: 2px; }
.mbk-control-field :disabled { opacity: .6; cursor: default; }
.mbk-control-field small { color: var(--chrome-muted); }
.mbk-control-field .mbk-control-supplied { display: flex; align-items: center; gap: 4px; position: absolute; right: 0; top: -3px; color: var(--chrome-muted); font-size: 11px; }
.mbk-control-field .mbk-control-error, .mbk-control-error { color: #9b3333; }
.mbk-control-actions { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.mbk-control-actions p { margin: 0 auto 0 0; color: var(--chrome-muted); }
@media (max-width: 56.25rem) {
  .mbk-workspace .mbk-screen-head { gap: 8px; padding: 12px; }
  .mbk-workspace .mbk-title-row { gap: 6px; flex-wrap: wrap; }
  .mbk-workspace .mbk-title-row h2 { font-size: 17px; }
  .mbk-selection-bar { padding: 8px 12px; }
  .mbk-workspace-panes { padding-bottom: 46px; }
  .mbk-inspector { position: absolute; left: 8px; right: 8px; bottom: 0; border: 1px solid var(--chrome-border); border-bottom: 0; border-radius: 14px 14px 0 0; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -5px 20px #0000000a; }
  .mbk-inspector[data-open="true"] { height: min(42%, 320px); min-height: 190px; max-height: calc(100% - 36px); }
  .mbk-inspector[data-expanded="true"][data-open="true"] { height: 80%; }
  .mbk-inspector-resize { display: none; }
  .mbk-inspector-tabs { padding: 4px 10px; }
  .mbk-inspector-content > section { padding: 8px 14px 20px; }
  .mbk-sheet-grab { display: grid; flex: none; place-items: center; height: 22px; padding: 0; border: 0; border-radius: 14px 14px 0 0; background: transparent; touch-action: none; cursor: ns-resize; }
  .mbk-sheet-grab span { width: 36px; height: 5px; border-radius: 9px; background: var(--chrome-muted); opacity: .5; }
  .mbk-inspector:not([data-open="true"]) .mbk-sheet-grab { display: none; }
}
`;
