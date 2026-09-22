import { COMPONENT_PAGES } from "../../components/parts/destinations.js";
import type { NavigationState } from "../../parts/navigation_states.js";

import {
  INTERACTIVE_PAGES,
  type InteractiveDesignDestination,
} from "./destinations.js";

/**
 * Only the preview-mode control moves between these artboards. Selecting Live
 * for the first time prepares the preview, so the static screen opens the
 * preparing state while the ready pair keeps its own transition. The
 * unavailable and static-only catalogues are entered from the catalogue
 * navigation, exactly like the Changes availability states.
 */
export const INTERACTIVE_NAVIGATION_STATES = {
  [INTERACTIVE_PAGES.overview]: {
    preview: { mode: "live", links: { static: INTERACTIVE_PAGES.static } },
  },
  [INTERACTIVE_PAGES.static]: {
    preview: { mode: "static", links: { live: INTERACTIVE_PAGES.preparing } },
  },
  [INTERACTIVE_PAGES.preparing]: {
    preview: { mode: "live", links: { static: INTERACTIVE_PAGES.static } },
  },
  [INTERACTIVE_PAGES.unavailable]: {
    preview: { mode: "static", unavailable: true },
  },
  [INTERACTIVE_PAGES.component]: {
    preview: { mode: "live", links: { static: COMPONENT_PAGES.default } },
  },
  [INTERACTIVE_PAGES.staticCatalogue]: {},
} satisfies Record<InteractiveDesignDestination, NavigationState>;
