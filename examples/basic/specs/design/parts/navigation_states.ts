import { CANVAS_PAGES as C } from "../canvas/parts/destinations.js";
import {
  CANVAS_NAVIGATION_STATES,
  type CanvasTransitions,
} from "../canvas/parts/navigation_states.js";
import { TAG_FILTERS } from "../canvas/search/parts/tags.js";

import { DESTINATIONS as D, type DesignDestination } from "./destinations.js";
import type { CatalogueTag } from "./tags.js";

/**
 * The artboards of one family's tag states of Welcome: by the tag that the
 * search enters, or none, the artboard with the tag picker closed and open.
 */
export type TagArtboards = Readonly<
  Record<
    "none" | CatalogueTag,
    Readonly<Record<"closed" | "open", DesignDestination>>
  >
>;

interface TagState {
  active: CatalogueTag | null;
  picker: boolean;
  /** The artboards of the family's tag states. */
  artboards: TagArtboards;
}

/** Only authored transitions are present; absence always means a depiction. */
export interface NavigationState {
  inspector?: DesignDestination;
  drawer?: { open: boolean; to: DesignDestination };
  all?: DesignDestination;
  changes?: DesignDestination;
  tags?: TagState;
  /** The transitions of a Canvas artboard's stage, panels, and dock. */
  canvas?: CanvasTransitions;
}

/**
 * Canonical states for the entire design registry, never inferred from
 * labels. The older tag picker that stays opens the Canvas artboards: All
 * opens Welcome's overview, and the tag picker's button and chips open the
 * Canvas search.
 */
export const NAVIGATION_STATES: Record<DesignDestination, NavigationState> = {
  ...CANVAS_NAVIGATION_STATES,
  [D.tagPicker]: {
    all: C.overview,
    changes: C.changesCurrent,
    tags: { active: null, picker: true, artboards: TAG_FILTERS },
  },
};

/** Open/close preserves the depicted query; a selection closes the picker. */
export function tagPickerTarget(
  tags: TagState | undefined,
): DesignDestination | undefined {
  if (!tags) return undefined;
  const state = tags.artboards[tags.active ?? "none"];
  return tags.picker ? state.closed : state.open;
}

/**
 * A chip enters its tag and closes the picker; the chip of the entered tag
 * clears the query.
 */
export function tagTarget(
  tags: TagState | undefined,
  tag: CatalogueTag,
): DesignDestination | undefined {
  if (!tags) return undefined;
  const artboards = tags.artboards;
  return (tags.active === tag ? artboards.none : artboards[tag]).closed;
}
