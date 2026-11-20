import type { NavigationState } from "../../parts/navigation_states.js";

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
   * The artboard that the right panel's Changes tab opens from Inspect. The
   * Changes artboards set it once they exist; until then the tab is a
   * picture.
   */
  changesTab?: CanvasDestination;
  /** The zoom pill's `+` and `−`. */
  zoomIn?: CanvasDestination;
  zoomOut?: CanvasDestination;
  /** Fit: the stage refitted around the shown frames. */
  fit?: CanvasDestination;
  /** The close control of the sheet that a compact artboard shows open. */
  close?: CanvasDestination;
  /** The dock's current tab, which opens the right panel as a sheet. */
  panelSheet?: CanvasDestination;
}

/** The Welcome stage fits its frames on the overview. */
const welcome = { zoomIn: C.zoomed, fit: C.overview } as const;

/**
 * Canonical states of the Canvas artboards. The catalogue filter of a
 * Welcome artboard opens the Changes filter, which keeps Welcome selected.
 */
export const CANVAS_NAVIGATION_STATES = {
  [C.overview]: { changes: C.catalogue, canvas: welcome },
  [C.zoomed]: { changes: C.catalogue, canvas: { fit: C.overview } },
  [C.componentSet]: { canvas: { fit: C.componentSet } },
  [C.document]: { canvas: { fit: C.document } },
  [C.catalogue]: {
    all: C.overview,
    canvas: { fit: C.catalogue, close: C.overview },
  },
  [C.home]: {},
  [C.unchanged]: { canvas: { fit: C.unchanged, panelSheet: C.unchanged } },
} satisfies Record<CanvasDestination, NavigationState>;
