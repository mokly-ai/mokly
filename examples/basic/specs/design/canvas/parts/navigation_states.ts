import type { NavigationState } from "../../parts/navigation_states.js";
import { EXPLORER_NAVIGATION_STATES } from "../components/parts/navigation.js";
import { EVIDENCE_NAVIGATION_STATES } from "../evidence/parts/navigation.js";
import { FLOW_NAVIGATION_STATES } from "../flows/parts/navigation.js";
import { LOADING_NAVIGATION_STATES } from "../loading/parts/navigation.js";
import { OUTCOME_NAVIGATION_STATES } from "../outcomes/parts/navigation.js";
import { PROPS_NAVIGATION_STATES } from "../props/parts/navigation.js";
import { SEARCH_NAVIGATION_STATES } from "../search/parts/navigation.js";
import { TAG_FILTERS } from "../search/parts/tags.js";

import { CANVAS_PAGES as C, type CanvasDestination } from "./destinations.js";

/**
 * The authored transitions of a Canvas artboard's own controls. Each names
 * the Canvas artboard that shows the control's outcome; an absent one leaves
 * the control a picture of itself.
 */
export interface CanvasTransitions {
  /** The artboard that the right panel's Inspect tab opens from Changes. */
  inspectTab?: CanvasDestination;
  /**
   * The artboard that the right panel's Changes tab opens from Inspect: the
   * entry's Changes artboard, where one shows the entry.
   */
  changesTab?: CanvasDestination;
  /** The zoom pill's `+` and `−`. */
  zoomIn?: CanvasDestination;
  zoomOut?: CanvasDestination;
  /** Fit: the stage refitted around the shown frames. */
  fit?: CanvasDestination;
  /** The close control of the sheet that a compact artboard shows open. */
  close?: CanvasDestination;
  /**
   * The dock's current tab, and the selection pill above the dock, which
   * open the right panel as a sheet.
   */
  panelSheet?: CanvasDestination;
}

/** The Welcome stage fits its frames on the overview. */
const welcome = { zoomIn: C.zoomed, fit: C.overview } as const;

/** Welcome's Inspect opens its Changes in Current, from any state. */
const changes = { changesTab: C.changesCurrent } as const;

/**
 * A Changes artboard of Welcome: its Inspect tab returns to the overview,
 * where Inspect selects again and the catalogue lists All, and Fit refits
 * the artboard's own frames.
 */
const welcomeMode = (fit: CanvasDestination) => ({
  canvas: { inspectTab: C.overview, fit },
});

/** A variant set fits at full size, so Fit keeps its state, selection and all. */
const fitted = (fit: CanvasDestination) => ({ canvas: { fit } });

/** A selection on Details zooms its phone frame, and Changes opens its own. */
const detailsSelection = { canvas: { changesTab: C.addedChanges } } as const;

/**
 * Canonical states of the Canvas artboards. The catalogue filter of a
 * Welcome artboard opens the Changes filter, which keeps Welcome selected.
 * While an instance of a screen is selected, the canvas is zoomed onto it,
 * and no artboard shows another zoom with the selection, so the zoom
 * controls are pictures there; the panel sheet with Welcome's selection is
 * the sections state. A variant set keeps its fitted zoom with a selection.
 * No artboard shows a variant set's selection with its sheet closed, so the
 * open sheet's close is a picture there. Payment terms has no Changes
 * artboard, so its Changes tab is a picture. The overview is Welcome's
 * search with no query: its tag picker button opens the picker, and its
 * Tags row's chips open their filters.
 */
export const CANVAS_NAVIGATION_STATES = {
  ...OUTCOME_NAVIGATION_STATES,
  ...LOADING_NAVIGATION_STATES,
  ...SEARCH_NAVIGATION_STATES,
  ...EXPLORER_NAVIGATION_STATES,
  ...PROPS_NAVIGATION_STATES,
  ...EVIDENCE_NAVIGATION_STATES,
  ...FLOW_NAVIGATION_STATES,
  [C.overview]: {
    changes: C.catalogue,
    tags: { active: null, picker: false, artboards: TAG_FILTERS },
    canvas: { ...welcome, ...changes },
  },
  [C.zoomed]: {
    changes: C.catalogue,
    canvas: { fit: C.overview, ...changes },
  },
  [C.componentSet]: fitted(C.componentSet),
  [C.componentSetDisabled]: fitted(C.componentSetDisabled),
  [C.componentSetToolbar]: fitted(C.componentSetToolbar),
  [C.componentSetPrimary]: fitted(C.componentSetPrimary),
  [C.componentSetSecondary]: fitted(C.componentSetSecondary),
  [C.document]: { canvas: { fit: C.document } },
  [C.catalogue]: {
    all: C.overview,
    canvas: { fit: C.catalogue, close: C.overview, ...changes },
  },
  [C.home]: {},
  [C.unchanged]: { canvas: { fit: C.unchanged, panelSheet: C.unchanged } },
  [C.selection]: {
    changes: C.catalogue,
    canvas: { panelSheet: C.sections, ...changes },
  },
  [C.selectionToolbar]: { changes: C.catalogue, canvas: changes },
  [C.selectionPrimary]: { changes: C.catalogue, canvas: changes },
  [C.selectionSecondary]: { changes: C.catalogue, canvas: changes },
  [C.sections]: {
    changes: C.catalogue,
    canvas: { close: C.selection, ...changes },
  },
  [C.props]: {
    changes: C.catalogue,
    canvas: { ...welcome, fit: C.props, close: C.overview, ...changes },
  },
  [C.frames]: {
    changes: C.catalogue,
    canvas: { fit: C.frames, ...changes },
  },
  [C.changesCurrent]: welcomeMode(C.changesCurrent),
  [C.changesSide]: welcomeMode(C.changesSide),
  [C.changesOverlay]: welcomeMode(C.changesOverlay),
  [C.changesDifference]: welcomeMode(C.changesDifference),
  [C.changesSwipe]: welcomeMode(C.changesSwipe),
  [C.added]: { canvas: { changesTab: C.addedChanges, fit: C.added } },
  [C.addedChanges]: { canvas: { inspectTab: C.added, fit: C.addedChanges } },
  [C.addedWelcome]: detailsSelection,
  [C.addedToolbar]: detailsSelection,
  [C.addedPrimary]: detailsSelection,
  [C.addedSecondary]: detailsSelection,
} satisfies Record<CanvasDestination, NavigationState>;
