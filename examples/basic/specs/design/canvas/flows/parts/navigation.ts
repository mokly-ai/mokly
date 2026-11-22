import type { NavigationState } from "../../../parts/navigation_states.js";

import type { FlowDestination } from "./destinations.js";

/**
 * The authored transitions of the Use case artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const FLOW_NAVIGATION_STATES = {} satisfies Record<
  FlowDestination,
  NavigationState
>;
