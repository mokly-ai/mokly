import type { NavigationState } from "../../../parts/navigation_states.js";

import type { SearchDestination } from "./destinations.js";

/**
 * The authored transitions of the Search artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const SEARCH_NAVIGATION_STATES = {} satisfies Record<
  SearchDestination,
  NavigationState
>;
