import type { NavigationState } from "../../../parts/navigation_states.js";
import { CANVAS_PAGES } from "../../parts/destinations.js";

import {
  EXPLORER_PAGES as E,
  type ExplorerDestination,
} from "./destinations.js";

/** An artboard whose Fit refits its own frames, with its other transitions. */
const fitted = (
  fit: ExplorerDestination,
  canvas: NonNullable<NavigationState["canvas"]> = {},
): NavigationState => ({ canvas: { ...canvas, fit } });

/**
 * The authored transitions of the Component explorer artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * The changed Default variant moves between Inspect in Current and its
 * Changes tab, whose Inspect tab keeps Overlay on the frames. No artboard
 * shows Inspect with Side by side or Difference on, or a sheet of these
 * states closed again, so those controls are pictures. The affected screens
 * have no Inspect artboard on their branch, so their Inspect tab is a
 * picture. Details' inspection states open Details' Changes tab of the
 * canonical branch. The removed Compact's tabs move between Inspect and its
 * comparison.
 */
export const EXPLORER_NAVIGATION_STATES = {
  [E.explorerCompare]: fitted(E.explorerCompare, {
    inspectTab: E.explorerCompareProps,
  }),
  [E.explorerCompareCurrent]: fitted(E.explorerCompareCurrent, {
    inspectTab: E.explorerUsage,
  }),
  [E.explorerCompareSide]: fitted(E.explorerCompareSide),
  [E.explorerCompareDifference]: fitted(E.explorerCompareDifference),
  [E.explorerCompareProps]: fitted(E.explorerCompareProps, {
    changesTab: E.explorerCompare,
  }),
  [E.explorerUsage]: fitted(E.explorerUsage, {
    changesTab: E.explorerCompareCurrent,
  }),
  [E.explorerUsageLoading]: fitted(E.explorerUsageLoading, {
    changesTab: E.explorerCompareCurrent,
  }),
  [E.explorerUsageFailed]: fitted(E.explorerUsageFailed, {
    changesTab: E.explorerCompareCurrent,
  }),
  [E.explorerAffected]: fitted(E.explorerAffected),
  [E.explorerAffectedDetails]: fitted(E.explorerAffectedDetails),
  [E.explorerInspection]: fitted(E.explorerInspection, {
    changesTab: CANVAS_PAGES.addedChanges,
  }),
  [E.explorerInspectionUnavailable]: fitted(E.explorerInspectionUnavailable, {
    changesTab: CANVAS_PAGES.addedChanges,
  }),
  [E.explorerRemoved]: fitted(E.explorerRemoved, {
    changesTab: E.explorerRemovedChanges,
  }),
  [E.explorerRemovedChanges]: fitted(E.explorerRemovedChanges, {
    inspectTab: E.explorerRemoved,
  }),
} satisfies Record<ExplorerDestination, NavigationState>;
