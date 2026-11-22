import type { NavigationState } from "../../parts/navigation_states.js";

import {
  COMPONENT_PAGES,
  INSPECTION_PAGES,
  type ComponentDesignDestination,
} from "./destinations.js";

/** Shared shell controls do not inherit unrelated Browse transitions. */
export const COMPONENT_NAVIGATION_STATES = {
  [COMPONENT_PAGES.removed]: {},
  [INSPECTION_PAGES["removed-consumer"]]: {},
} satisfies Record<ComponentDesignDestination, NavigationState>;
