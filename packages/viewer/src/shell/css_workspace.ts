/** The workspace's bounded preview pane and highlight layer.
 * `@mokly/ui/view-controls` styles the view controls, `@mokly/ui/inspector`
 * and the components of its panels style the inspector,
 * `@mokly/ui/variant-bar` the variant bar, and `@mokly/ui/stage` and
 * `@mokly/ui/preview-frame` the component stage. */

import { NARROW_SHELL } from "./layout_breakpoint.js";

export const SHELL_WORKSPACE_CSS = `
.mbk-workspace {
  display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden;
}
.mbk:has(.mbk-workspace) .mbk-topbar [data-mokly-schemeswitch] { display: none; }
.mbk-workspace [hidden] { display: none !important; }
.mbk-workspace .mbk-screen-head { align-items: center; }
.mbk-workspace-panes { display: flex; flex: 1; flex-direction: column; position: relative; min-height: 0; min-width: 0; }
.mbk-preview-pane { position: relative; display: flex; flex: 1; flex-direction: column; min-height: 100px; min-width: 0; overflow: hidden; }
.mbk-preview-busy { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; }
.mbk-workspace [data-mokly-stage][data-viewport="mobile"] .mbk-frame-desktop,
.mbk-workspace [data-mokly-stage][data-viewport="desktop"] .mbk-frame-mobile { display: none; }
.mbk-highlight-layer { position: fixed; pointer-events: none; z-index: 4; overflow: hidden; }
.mbk-highlight-layer svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.mbk-highlight-label { position: absolute; pointer-events: auto; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0; border-radius: 4px; background: var(--mbk-accent-deep); color: var(--_mokly-private-on-accent-deep); padding: 3px 7px; font: 11px var(--sans); cursor: pointer; }
@media ${NARROW_SHELL} {
  .mbk-workspace .mbk-screen-head { gap: 8px; padding: 12px; }
  .mbk-workspace-panes { padding-bottom: 46px; }
  .mbk-workspace .mbk-previous { padding: 8px 12px; }
}
`;
