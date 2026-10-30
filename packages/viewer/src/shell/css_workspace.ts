/** The workspace's bounded preview pane, variant bar, component stage, and
 * highlight layer. `@mokly/ui/view-controls` styles the view controls, and
 * `@mokly/ui/inspector` and the components of its panels style the
 * inspector. */

import { NARROW_SHELL } from "./layout_breakpoint.js";

export const SHELL_WORKSPACE_CSS = `
.mbk-workspace {
  display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden;
}
.mbk:has(.mbk-workspace) .mbk-topbar [data-mokly-schemeswitch] { display: none; }
.mbk-workspace [hidden] { display: none !important; }
.mbk-workspace .mbk-screen-head { align-items: center; }
.mbk-selection-bar {
  display: flex; align-items: center; flex: none; flex-wrap: wrap; gap: 6px; padding: 10px 24px;
  background: var(--chrome-surface); border-bottom: 1px solid var(--chrome-border); font-size: 12px;
}
.mbk-selection-bar:has(> [hidden]:only-child) { display: none; }
.mbk-selection-bar > span:first-child { color: var(--chrome-muted); margin-right: 10px; }
.mbk-selection-bar a {
  border: 1px solid transparent; border-radius: 6px; color: var(--chrome-ink-2); padding: 5px 10px; text-decoration: none;
}
.mbk-selection-bar a:hover { background: var(--chrome-bg); }
.mbk-selection-bar a:focus-visible { outline: 2px solid var(--mokly-accent); outline-offset: 2px; }
.mbk-selection-bar a[aria-current="page"] {
  background: var(--mokly-accent-soft); border-color: var(--mokly-accent); color: var(--mokly-accent); font-weight: 600;
}
.mbk-variant-status { color: var(--chrome-muted); }
.mbk-workspace-panes { display: flex; flex: 1; flex-direction: column; position: relative; min-height: 0; min-width: 0; }
.mbk-preview-pane { position: relative; display: flex; flex: 1; flex-direction: column; min-height: 100px; min-width: 0; overflow: hidden; }
.mbk-preview-busy { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; }
.mbk-component-stage { align-items: flex-start; overflow: auto; }
.mbk-component-canvas { flex: none; }
.mbk-component-canvas.mbk-frame-mobile { width: 390px; }
.mbk-component-canvas.mbk-frame-desktop { width: 1024px; }
.mbk-component-canvas iframe { width: 100%; height: 520px; display: block; border: 1px solid var(--chrome-border); border-radius: 8px; }
.mbk-workspace [data-mokly-stage][data-viewport="mobile"] .mbk-frame-desktop,
.mbk-workspace [data-mokly-stage][data-viewport="desktop"] .mbk-frame-mobile { display: none; }
.mb-component-frame { width: 100%; min-width: 390px; height: 520px; overflow: hidden; border: 1px solid var(--chrome-border); border-radius: 8px; }
.mbk-highlight-layer { position: fixed; pointer-events: none; z-index: 4; overflow: hidden; }
.mbk-highlight-layer svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.mbk-highlight-label { position: absolute; pointer-events: auto; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0; border-radius: 4px; background: var(--mbk-accent-deep); color: var(--_mokly-private-on-accent-deep); padding: 3px 7px; font: 11px var(--sans); cursor: pointer; }
@media ${NARROW_SHELL} {
  .mbk-workspace .mbk-screen-head { gap: 8px; padding: 12px; }
  .mbk-selection-bar { padding: 8px 12px; }
  .mbk-workspace-panes { padding-bottom: 46px; }
}
`;
