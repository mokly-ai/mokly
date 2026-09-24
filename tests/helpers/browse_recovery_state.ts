import type { BrowseRecoveryState } from "../../packages/viewer/dist/runtime.js";

/** Shared current-shape Browse recovery snapshot for unit tests. */
export function browseState(): BrowseRecoveryState {
  return {
    changedOnly: true,
    disclosures: { "folder:pages:fixture": false },
    colorScheme: "dark",
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineDisclosures: { "folder:pages:fixture": false },
    navScroll: 18,
    query: "home",
    regionScrolls: { flow: 8, stage: 42 },
    viewport: "mobile",
  };
}
