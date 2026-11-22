import type { NavigationState } from "../../../parts/navigation_states.js";
import {
  CANVAS_PAGES as C,
  type CanvasDestination,
} from "../../parts/destinations.js";

import type { LoadingDestination } from "./destinations.js";

/**
 * A Changes filter that waits, failed, or found nothing: All stays
 * selectable and opens Welcome in All, and Fit refits the artboard's own
 * frames. No artboard shows these states zoomed or with the sheet closed, so
 * Zoom in and the sheet's close are pictures.
 */
const changesFilter = (fit: CanvasDestination): NavigationState => ({
  all: C.overview,
  canvas: { fit },
});

/**
 * Welcome's stage while its detail loads or after it failed: the Changes
 * filter keeps Welcome selected. The canvas holds no section, so it draws no
 * zoom controls. No artboard shows the Changes tab or the panel sheet before
 * the entry's detail arrives, so those controls are pictures.
 */
const entryStage: NavigationState = { changes: C.catalogue };

/**
 * The authored transitions of the Loading and recovery artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * A startup page holds its state's action alone. A catalogue without
 * comparison data has no filter, and the missing route selects nothing.
 */
export const LOADING_NAVIGATION_STATES = {
  [C.loadingCatalogue]: {},
  [C.loadingCatalogueFailed]: {},
  [C.loadingCatalogueVersion]: {},
  [C.loadingEntry]: entryStage,
  [C.loadingEntryFailed]: entryStage,
  [C.loadingChanges]: changesFilter(C.loadingChanges),
  [C.loadingChangesPreparing]: changesFilter(C.loadingChangesPreparing),
  [C.loadingChangesUnavailable]: changesFilter(C.loadingChangesUnavailable),
  [C.loadingChangesEmpty]: changesFilter(C.loadingChangesEmpty),
  [C.loadingChangesWithout]: { canvas: { fit: C.loadingChangesWithout } },
  [C.loadingMissing]: {},
} satisfies Record<LoadingDestination, NavigationState>;
