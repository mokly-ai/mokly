import type { NavigationState } from "../../../parts/navigation_states.js";
import { CANVAS_PAGES as C } from "../../parts/destinations.js";

import { OUTCOME_PAGES as O, type OutcomeDestination } from "./destinations.js";

/** An artboard whose Fit refits its own frames, with its other transitions. */
const fitted = (
  fit: OutcomeDestination,
  canvas: NonNullable<NavigationState["canvas"]> = {},
): NavigationState => ({ canvas: { ...canvas, fit } });

/**
 * A removed screen of the canonical branch: the entry is not in All, so the
 * All filter opens the catalogue home.
 */
const canonical = (state: NavigationState): NavigationState => ({
  ...state,
  all: C.home,
});

/**
 * The authored transitions of the Change outcomes artboards that this family
 * adds beside the added entry. `../../parts/navigation_states.ts` spreads
 * them into the family's states. The moved Invoice's tabs move between its
 * Changes tab and Inspect, and so do Farewell's and Save failed's. Each Fit
 * opens its own fitted artboard, and a state that loads or failed holds no
 * section, so it has no Fit. No artboard zooms these entries, so the zoom
 * controls are pictures, and no artboard shows the other removed entries on
 * their other tab, so those tabs are pictures. A tab switch keeps the
 * catalogue's filter. On a phone, an open panel sheet's close is a picture,
 * because no artboard shows that tab with the sheet closed. The removed
 * document and variant branches are branches of their own, so their All
 * filter is a picture.
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
  [O.removed]: canonical(fitted(O.removed, { inspectTab: O.removedInspect })),
  [O.removedInspect]: canonical(
    fitted(O.removedInspect, {
      changesTab: O.removed,
      panelSheet: O.removedInspect,
    }),
  ),
  [O.removedLong]: canonical(fitted(O.removedLong)),
  [O.removedLoading]: canonical({}),
  [O.removedUnavailable]: canonical({}),
  [O.removedNoView]: canonical(fitted(O.removedNoView)),
  [O.removedDocument]: fitted(O.removedDocument),
  [O.removedDocumentLong]: fitted(O.removedDocumentLong),
  [O.removedDocumentLoading]: {},
  [O.removedDocumentUnavailable]: {},
  [O.removedDocumentLightOnly]: fitted(O.removedDocumentLightOnly),
  [O.removedVariant]: fitted(O.removedVariant, {
    inspectTab: O.removedVariantInspect,
    panelSheet: O.removedVariant,
  }),
  [O.removedVariantInspect]: fitted(O.removedVariantInspect, {
    changesTab: O.removedVariant,
    panelSheet: O.removedVariantInspect,
  }),
} satisfies Record<OutcomeDestination, NavigationState>;
