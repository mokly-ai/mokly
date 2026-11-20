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
} as const;

export type CanvasDestination =
  (typeof CANVAS_PAGES)[keyof typeof CANVAS_PAGES];
