import type { NavigationState } from "../../../parts/navigation_states.js";
import type { CatalogueTag } from "../../../parts/tags.js";
import { CANVAS_PAGES as C } from "../../parts/destinations.js";

import { SEARCH_PAGES as S, type SearchDestination } from "./destinations.js";
import { TAG_FILTERS } from "./tags.js";

/**
 * A search state of Welcome among the Canvas artboards: the picker's button
 * opens the same query with the picker toggled, and each tag chip, in the
 * picker and in Inspect's Tags row, opens its filter with the picker closed,
 * or, for the entered tag, the overview.
 */
function tags(active: CatalogueTag | null, picker: boolean) {
  return { active, picker, artboards: TAG_FILTERS };
}

/**
 * The authored transitions of the Search artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * With no query, a click outside the open picker closes it, so each control
 * opens what it opens on the overview. A filtered artboard keeps its query:
 * Fit refits it with the picker closed, and the Changes filter, the Changes
 * tab, and Zoom in keep the query too, which no artboard shows, so they are
 * pictures. Each catalogue row opens its entry's artboard.
 */
export const SEARCH_NAVIGATION_STATES = {
  [S.tagPicker]: {
    changes: C.catalogue,
    tags: tags(null, true),
    canvas: { zoomIn: C.zoomed, fit: C.overview, changesTab: C.changesCurrent },
  },
  [S.tagForms]: { tags: tags("forms", false), canvas: { fit: S.tagForms } },
  [S.tagFormsPicker]: {
    tags: tags("forms", true),
    canvas: { fit: S.tagForms },
  },
  [S.tagOnboarding]: {
    tags: tags("onboarding", false),
    canvas: { fit: S.tagOnboarding },
  },
  [S.tagOnboardingPicker]: {
    tags: tags("onboarding", true),
    canvas: { fit: S.tagOnboarding },
  },
} satisfies Record<SearchDestination, NavigationState>;
