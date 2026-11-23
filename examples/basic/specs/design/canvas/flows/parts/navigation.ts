import type { NavigationState } from "../../../parts/navigation_states.js";

import { FLOW_PAGES as F, type FlowDestination } from "./destinations.js";

/**
 * The authored transitions of the Use case artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * Each Fit refits the artboard's own section. On a phone, the dock's Inspect
 * opens the panel sheet at the Frames filter, which still chooses Mobile and
 * Light, and the sheet's close returns to the use case. No artboard shows
 * the use case zoomed, in the Changes filter, or with the sheet open on Dark
 * or on the second step, so those controls are pictures. The Frames filter
 * and the frame picker work in place.
 */
export const FLOW_NAVIGATION_STATES = {
  [F.useCase]: { canvas: { fit: F.useCase, panelSheet: F.useCaseMobile } },
  [F.useCaseMobile]: { canvas: { fit: F.useCaseMobile, close: F.useCase } },
  [F.useCaseDark]: { canvas: { fit: F.useCaseDark } },
  [F.useCaseSecondStep]: { canvas: { fit: F.useCaseSecondStep } },
} satisfies Record<FlowDestination, NavigationState>;
