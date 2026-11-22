import type { NavigationState } from "../../../parts/navigation_states.js";

import type { LoadingDestination } from "./destinations.js";

/**
 * The authored transitions of the Loading and recovery artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const LOADING_NAVIGATION_STATES = {} satisfies Record<
  LoadingDestination,
  NavigationState
>;
