/**
 * The Loading and recovery artboards of the Canvas viewer family. `../../parts/destinations.ts`
 * spreads them into `CANVAS_PAGES`, so Canvas links reach them. Each key
 * starts with `loading`, so no key of another state kind replaces one.
 */
export const LOADING_PAGES = {
  loadingCatalogue: "design/canvas/loading/catalogue",
  loadingCatalogueFailed: "design/canvas/loading/catalogue/failed",
  loadingCatalogueVersion: "design/canvas/loading/catalogue/version",
  loadingEntry: "design/canvas/loading/entry",
  loadingEntryFailed: "design/canvas/loading/entry/failed",
  loadingChanges: "design/canvas/loading/changes",
  loadingChangesPreparing: "design/canvas/loading/changes/preparing",
  loadingChangesUnavailable: "design/canvas/loading/changes/unavailable",
  loadingChangesEmpty: "design/canvas/loading/changes/empty",
  loadingChangesWithout: "design/canvas/loading/changes/without-changes",
  loadingMissing: "design/canvas/loading/missing",
} as const;

export type LoadingDestination =
  (typeof LOADING_PAGES)[keyof typeof LOADING_PAGES];
