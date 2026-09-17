export { applyNavigationEvidence } from "./client/browse_evidence.js";
export {
  readPageStamp,
  navigationPending,
  waitForNavigation,
} from "./client/browse_update_state.js";
export { parseBrowseRecoveryState } from "./client/browse_recovery.js";
export {
  captureBrowseState,
  restoreBrowseState,
} from "./client/browse_state.js";
export type { BrowseRecoveryState } from "./client/browse_state.js";
export { workspaceEvidence } from "./client/workspace_updates.js";
export { localFramePath } from "./client/same_origin_adapter.js";
export { BYTE_LIMIT } from "./inspector/values.js";
export { compactRanges, readMetadata } from "./inspector/metadata.js";
export type { LinkIdentity } from "./inspector/metadata.js";
export { initializeBrowseShell } from "./client/browse.js";
export {
  installViewerServices,
  loadCatalogueRevisionAdopter,
} from "./client/services.js";
export { adoptCatalogueRevision } from "./client/catalogue_updates.js";
