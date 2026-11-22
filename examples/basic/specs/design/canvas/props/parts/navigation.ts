import type { NavigationState } from "../../../parts/navigation_states.js";

import type { PropsDestination } from "./destinations.js";

/**
 * The authored transitions of the Props and controls artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const PROPS_NAVIGATION_STATES = {} satisfies Record<
  PropsDestination,
  NavigationState
>;
