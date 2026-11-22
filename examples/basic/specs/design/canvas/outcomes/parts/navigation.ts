import type { NavigationState } from "../../../parts/navigation_states.js";

import type { OutcomeDestination } from "./destinations.js";

/**
 * The authored transitions of the Change outcomes artboards that this family adds beside the added entry.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const OUTCOME_NAVIGATION_STATES = {} satisfies Record<
  OutcomeDestination,
  NavigationState
>;
