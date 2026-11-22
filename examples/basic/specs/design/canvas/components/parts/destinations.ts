/**
 * The Component explorer artboards of the Canvas viewer family: a changed
 * component compared on its variant set, its usage, the screens that its
 * change affects, screen inspection while it waits or is unavailable, and a
 * removed saved variant. `../../parts/destinations.ts` spreads them into
 * `CANVAS_PAGES`, so Canvas links reach them.
 */
export const EXPLORER_PAGES = {
  explorerCompare: "design/canvas/components/compare",
  explorerCompareCurrent: "design/canvas/components/compare/current",
  explorerCompareDifference: "design/canvas/components/compare/difference",
  explorerCompareProps: "design/canvas/components/compare/props",
  explorerUsage: "design/canvas/components/usage",
  explorerUsageLoading: "design/canvas/components/usage/loading",
  explorerAffected: "design/canvas/components/affected",
  explorerAffectedDetails: "design/canvas/components/affected/details",
  explorerInspection: "design/canvas/components/inspection",
  explorerInspectionUnavailable:
    "design/canvas/components/inspection/unavailable",
  explorerRemoved: "design/canvas/components/removed",
  explorerRemovedChanges: "design/canvas/components/removed/changes",
} as const;

export type ExplorerDestination =
  (typeof EXPLORER_PAGES)[keyof typeof EXPLORER_PAGES];
