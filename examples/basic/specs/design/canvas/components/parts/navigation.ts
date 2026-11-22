import type { NavigationState } from "../../../parts/navigation_states.js";

import type { ExplorerDestination } from "./destinations.js";

/**
 * The authored transitions of the Component explorer artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const EXPLORER_NAVIGATION_STATES = {} satisfies Record<
  ExplorerDestination,
  NavigationState
>;
