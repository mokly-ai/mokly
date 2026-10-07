/** Embedding extensions are scoped away from the standalone shell. */

import { VIEWER_DIRECTORY } from "../catalogue/delivery_paths.js";
export const VIEWER_CSS = `
.${VIEWER_DIRECTORY} { position:relative; isolation:isolate; height:100%; min-height:0; color:var(--chrome-ink); font-family:var(--sans); line-height:1.5; }
@scope (.${VIEWER_DIRECTORY}) to ([data-mokly-slot]) {
  :scope.mbk { height:100%; min-height:0; overflow:hidden; }
}
.${VIEWER_DIRECTORY} > .mbk-body { display:flex; flex:1; min-height:0; overflow:hidden; }
.${VIEWER_DIRECTORY} .mokly-top-host { container:mokly-top-host / inline-size; position:relative; display:flex; flex:none; min-width:0; height:48px; background:var(--chrome-surface); }
.${VIEWER_DIRECTORY} .mokly-top-host .mbk-topbar { flex:1; min-width:0; }
.${VIEWER_DIRECTORY} .mokly-rail-host { display:flex; flex-direction:column; flex:none; min-height:0; }
.${VIEWER_DIRECTORY} .mokly-rail-host .mbk-nav { flex:1; min-height:0; }
.${VIEWER_DIRECTORY} .mokly-stage-host { position:relative; flex:1; display:flex; min-width:0; min-height:0; }
.${VIEWER_DIRECTORY} .mokly-stage-host .mbk-main { flex:1; }
.${VIEWER_DIRECTORY} [data-mokly-slot]:empty { display:none; }
.${VIEWER_DIRECTORY} [data-mokly-slot="stageOverlay"] { position:absolute; z-index:10; overflow:hidden; }
.${VIEWER_DIRECTORY} [data-mokly-marker-layer], .${VIEWER_DIRECTORY} [data-mokly-label-layer] { display:block; position:absolute; inset:0; pointer-events:none; z-index:11; }
.${VIEWER_DIRECTORY} [data-mokly-slot="markers"]:empty { display:block; }
.${VIEWER_DIRECTORY}.frame-expanded :is([data-mokly-marker-layer], [data-mokly-label-layer]) { z-index:952; }
.${VIEWER_DIRECTORY} [data-mokly-slot="sidePanel"] { flex:none; overflow:auto; min-height:0; }
.${VIEWER_DIRECTORY} [data-mokly-slot="emptyState"] { position:absolute; inset:0; background:var(--chrome-bg); overflow:auto; }
.${VIEWER_DIRECTORY} [data-mokly-slot][hidden] { display:none; }
.${VIEWER_DIRECTORY} [data-mokly-slot="topBarStart"], .${VIEWER_DIRECTORY} [data-mokly-slot="topBarEnd"] { display:flex; flex:none; align-items:center; }
@media(max-width:56.249rem) { .${VIEWER_DIRECTORY} .mokly-rail-host { width:0; } }
@container mokly-top-host (max-width:35rem) {
  .mokly-top-host > .mbk-topbar { gap:8px; padding:0 8px; }
  .mokly-top-host > .mbk-topbar .mbk-brand,
  .mokly-top-host > .mbk-topbar .mbk-search,
  .mokly-top-host > .mbk-topbar .mbk-search-close { display:none; }
  .mokly-top-host > .mbk-topbar .mbk-search-toggle { display:inline-flex; }
  .mokly-top-host > .mbk-topbar[data-compact-search="open"] {
    position:absolute; inset:0; z-index:12; width:auto; background:var(--chrome-surface);
  }
  .mokly-top-host > .mbk-topbar[data-compact-search="open"] > :not(.mbk-search, .mbk-search-close) { display:none; }
  .mokly-top-host > .mbk-topbar[data-compact-search="open"] .mbk-search {
    display:flex; max-width:none;
  }
  .mokly-top-host > .mbk-topbar[data-compact-search="open"] .mbk-search-close { display:inline-flex; }
}
`;
