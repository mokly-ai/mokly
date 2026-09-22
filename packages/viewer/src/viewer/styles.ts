/** Embedding extensions are scoped away from the standalone shell. */
export const VIEWER_CSS = `
.mokly-viewer { position:relative; isolation:isolate; height:100%; min-height:0; color:var(--chrome-ink); font-family:var(--sans); line-height:1.5; }
@scope (.mokly-viewer) to ([data-mokly-slot]) {
  :scope.mbk { height:100%; min-height:0; overflow:hidden; }
}
.mokly-viewer > .mbk-body { display:flex; flex:1; min-height:0; overflow:hidden; }
.mokly-viewer .mokly-top-host { container:mokly-top-host / inline-size; position:relative; display:flex; flex:none; min-width:0; height:48px; background:var(--chrome-surface); }
.mokly-viewer .mokly-top-host .mbk-topbar { flex:1; min-width:0; }
.mokly-viewer .mokly-rail-host { display:flex; flex-direction:column; flex:none; min-height:0; }
.mokly-viewer .mokly-rail-host .mbk-nav { flex:1; min-height:0; }
.mokly-viewer .mokly-stage-host { position:relative; flex:1; display:flex; min-width:0; min-height:0; }
.mokly-viewer .mokly-stage-host .mbk-main { flex:1; }
.mokly-viewer [data-mokly-slot]:empty { display:none; }
.mokly-viewer [data-mokly-slot="stageOverlay"] { position:absolute; z-index:10; overflow:hidden; }
.mokly-viewer [data-mokly-marker-layer], .mokly-viewer [data-mokly-label-layer] { display:block; position:absolute; inset:0; pointer-events:none; z-index:11; }
.mokly-viewer [data-mokly-slot="markers"]:empty { display:block; }
.mokly-viewer.frame-expanded :is([data-mokly-marker-layer], [data-mokly-label-layer]) { z-index:952; }
.mokly-viewer [data-mokly-slot="sidePanel"] { flex:none; overflow:auto; min-height:0; }
.mokly-viewer [data-mokly-slot="emptyState"] { position:absolute; inset:0; background:var(--chrome-bg); overflow:auto; }
.mokly-viewer [data-mokly-slot][hidden] { display:none; }
.mokly-viewer [data-mokly-slot="topBarStart"], .mokly-viewer [data-mokly-slot="topBarEnd"] { display:flex; flex:none; align-items:center; }
@media(max-width:56.249rem) { .mokly-viewer .mokly-rail-host { width:0; } }
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
