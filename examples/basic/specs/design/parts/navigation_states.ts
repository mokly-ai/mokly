import {
  CANVAS_NAVIGATION_STATES,
  type CanvasTransitions,
} from "../canvas/parts/navigation_states.js";

import type { DesignDestination } from "./destinations.js";
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
  all?: DesignDestination;
  changes?: DesignDestination;
  tags?: TagState;
  /** The transitions of a Canvas artboard's stage, panels, and dock. */
  canvas?: CanvasTransitions;
}

/**
 * Canonical states for the entire design registry, never inferred from
 * labels: the states of the Canvas artboards.
 */
export const NAVIGATION_STATES: Record<DesignDestination, NavigationState> =
  CANVAS_NAVIGATION_STATES;

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
