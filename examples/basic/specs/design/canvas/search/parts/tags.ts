import type { TagArtboards } from "../../../parts/navigation_states.js";
import type { CatalogueTag } from "../../../parts/tags.js";
import {
  CANVAS_PAGES,
  type CanvasDestination,
} from "../../parts/destinations.js";

import { SEARCH_PAGES } from "./destinations.js";

/**
 * The Canvas artboards of Welcome's search, by the tag that its query
 * enters, with the tag picker closed and open. With no query and the picker
 * closed, the artboard is the overview. The tag states of these artboards
 * name this map, so the top bar's picker button and chips, and Inspect's
 * Tags row chips, open Canvas artboards.
 */
export const TAG_FILTERS = {
  none: { closed: CANVAS_PAGES.overview, open: SEARCH_PAGES.tagPicker },
  forms: { closed: SEARCH_PAGES.tagForms, open: SEARCH_PAGES.tagFormsPicker },
  onboarding: {
    closed: SEARCH_PAGES.tagOnboarding,
    open: SEARCH_PAGES.tagOnboardingPicker,
  },
} as const satisfies TagArtboards;

/** The artboard of a search state: its entered tag, and the picker. */
export function tagFilterPage(
  active: CatalogueTag | undefined,
  picker: boolean,
): CanvasDestination {
  return TAG_FILTERS[active ?? "none"][picker ? "open" : "closed"];
}
