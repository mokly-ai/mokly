import type { NavigationState } from "../../../parts/navigation_states.js";

import type { EvidenceDestination } from "./destinations.js";

/**
 * The authored transitions of the Comparison evidence artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 */
export const EVIDENCE_NAVIGATION_STATES = {} satisfies Record<
  EvidenceDestination,
  NavigationState
>;
