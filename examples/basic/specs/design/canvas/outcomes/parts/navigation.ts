import type { NavigationState } from "../../../parts/navigation_states.js";

import { OUTCOME_PAGES as O, type OutcomeDestination } from "./destinations.js";

/**
 * The authored transitions of the Change outcomes artboards that this family adds beside the added entry.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * The moved Invoice's tabs move between its Changes tab and Inspect, and
 * each Fit opens its own fitted artboard. No artboard zooms Invoice or shows
 * it in All with either tab, so the zoom controls and the All filter are
 * pictures. A tab switch keeps the catalogue's filter, so Inspect keeps the
 * Changes filter. On a phone, Inspect shows the panel sheet open, and no
 * artboard shows it closed, so its close is a picture.
 */
export const OUTCOME_NAVIGATION_STATES = {
  [O.moved]: { canvas: { inspectTab: O.movedInspect, fit: O.moved } },
  [O.movedInspect]: {
    canvas: {
      changesTab: O.moved,
      fit: O.movedInspect,
      panelSheet: O.movedInspect,
    },
  },
} satisfies Record<OutcomeDestination, NavigationState>;
