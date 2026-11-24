import type { NavigationState } from "../../../parts/navigation_states.js";

import { FLOW_PAGES as F, type FlowDestination } from "./destinations.js";

/** The Changes tab of every Inspect state opens the tour's Changes. */
const inspect = (
  canvas: NonNullable<NavigationState["canvas"]>,
): NavigationState => ({ canvas: { ...canvas, changesTab: F.useCaseChanges } });

/**
 * The authored transitions of the Use case artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * Each Fit refits the artboard's own section. The Changes tab of each
 * Inspect state opens the tour's Changes tab, whose Inspect tab returns to
 * the use case. On a phone, the dock's Inspect opens the panel sheet at the
 * Frames filter, which still chooses Mobile and Light, and the sheet's close
 * returns to the use case. No artboard shows the use case zoomed, on Inspect
 * in the Changes filter, on its Changes tab in All or with the Changes sheet
 * closed, or with the sheet open on Dark or on the second step, so those
 * controls are pictures. The Frames filter and the frame picker work in
 * place.
 */
export const FLOW_NAVIGATION_STATES = {
  [F.useCase]: inspect({ fit: F.useCase, panelSheet: F.useCaseMobile }),
  [F.useCaseChanges]: {
    canvas: { inspectTab: F.useCase, fit: F.useCaseChanges },
  },
  [F.useCaseMobile]: inspect({ fit: F.useCaseMobile, close: F.useCase }),
  [F.useCaseDark]: inspect({ fit: F.useCaseDark }),
  [F.useCaseSecondStep]: inspect({ fit: F.useCaseSecondStep }),
} satisfies Record<FlowDestination, NavigationState>;
