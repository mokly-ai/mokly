/** Embedding extensions are scoped away from the standalone shell. */
export const VIEWER_CSS = `
.mokly-viewer { position:relative; isolation:isolate; height:100%; min-height:0; color:var(--chrome-ink); font-family:var(--sans); line-height:1.5; }
.mokly-viewer .mokly-top-host { display:flex; flex:none; min-width:0; height:48px; background:var(--chrome-surface); }
.mokly-viewer .mokly-top-host .mbk-topbar { flex:1; min-width:0; }
.mokly-viewer .mokly-rail-host { display:flex; flex-direction:column; flex:none; min-height:0; }
.mokly-viewer .mokly-rail-host .mbk-nav { flex:1; min-height:0; }
.mokly-viewer .mokly-stage-host { position:relative; flex:1; display:flex; min-width:0; min-height:0; }
.mokly-viewer .mokly-stage-host .mbk-main { flex:1; }
.mokly-viewer [data-mokly-slot]:empty { display:none; }
.mokly-viewer [data-mokly-slot="stageOverlay"] { position:absolute; z-index:10; }
.mokly-viewer [data-mokly-slot="sidePanel"] { flex:none; overflow:auto; min-height:0; }
.mokly-viewer [data-mokly-slot="emptyState"] { position:absolute; inset:0; background:var(--chrome-bg); overflow:auto; }
.mokly-viewer [data-mokly-slot][hidden] { display:none; }
.mokly-viewer [data-mokly-slot="topBarStart"], .mokly-viewer [data-mokly-slot="topBarEnd"] { display:flex; align-items:center; }
@media(max-width:56.249rem) { .mokly-viewer .mokly-rail-host { width:0; } }
`;
