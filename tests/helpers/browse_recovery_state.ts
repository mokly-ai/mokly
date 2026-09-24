import type { BrowseRecoveryState } from "../../packages/viewer/dist/runtime.js";

/** Shared current-shape Browse recovery snapshot for unit tests. */
export function browseState(): BrowseRecoveryState {
  return {
    changedOnly: true,
    closedFolderKeys: ["folder:pages:fixture"],
    colorScheme: "dark",
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineClosedFolderKeys: ["folder:pages:fixture"],
    navScroll: 18,
    query: "home",
    regionScrolls: { flow: 8, stage: 42 },
    viewport: "mobile",
  };
}
