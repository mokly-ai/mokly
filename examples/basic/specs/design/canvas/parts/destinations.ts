/**
 * The artboards of the Canvas viewer family. Canvas links stay inside the
 * family: a control opens the Canvas artboard that shows its outcome, and a
 * control without one is a picture of itself.
 */
export const CANVAS_PAGES = {
  overview: "design/canvas/overview",
  zoomed: "design/canvas/stage/zoomed",
  componentSet: "design/canvas/stage/component-set",
  document: "design/canvas/stage/document",
  catalogue: "design/canvas/stage/catalogue",
  home: "design/canvas/stage/home",
  unchanged: "design/canvas/inspect/unchanged",
  selection: "design/canvas/inspect/selection",
  selectionToolbar: "design/canvas/inspect/selection/toolbar",
  selectionPrimary: "design/canvas/inspect/selection/primary",
  selectionSecondary: "design/canvas/inspect/selection/secondary",
  sections: "design/canvas/inspect/sections",
  props: "design/canvas/inspect/props",
  frames: "design/canvas/inspect/frames",
  changesCurrent: "design/canvas/changes/current",
  changesSide: "design/canvas/changes/side-by-side",
  changesOverlay: "design/canvas/changes/overlay",
  changesDifference: "design/canvas/changes/difference",
  changesSwipe: "design/canvas/changes/swipe",
  added: "design/canvas/outcomes/added",
  addedChanges: "design/canvas/outcomes/added/changes",
} as const;

export type CanvasDestination =
  (typeof CANVAS_PAGES)[keyof typeof CANVAS_PAGES];

/** The Changes artboards of Welcome, one for each compare mode. */
export const WELCOME_MODES = {
  current: CANVAS_PAGES.changesCurrent,
  "side-by-side": CANVAS_PAGES.changesSide,
  overlay: CANVAS_PAGES.changesOverlay,
  difference: CANVAS_PAGES.changesDifference,
  swipe: CANVAS_PAGES.changesSwipe,
} as const;
