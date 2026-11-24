import { EXPLORER_PAGES } from "../components/parts/destinations.js";
import { EVIDENCE_PAGES } from "../evidence/parts/destinations.js";
import { FLOW_PAGES } from "../flows/parts/destinations.js";
import { LOADING_PAGES } from "../loading/parts/destinations.js";
import { OUTCOME_PAGES } from "../outcomes/parts/destinations.js";
import { PROPS_PAGES } from "../props/parts/destinations.js";
import { SEARCH_PAGES } from "../search/parts/destinations.js";

/**
 * The stage, Inspect, Changes and added-entry artboards of the Canvas viewer
 * family. Each state kind that the family adds later keeps its own pages in
 * its folder's `parts/destinations.ts`.
 */
const STAGE_PAGES = {
  overview: "design/canvas/overview",
  zoomed: "design/canvas/stage/zoomed",
  componentSet: "design/canvas/stage/component-set",
  componentSetDisabled: "design/canvas/stage/component-set/disabled",
  componentSetToolbar: "design/canvas/stage/component-set/toolbar",
  componentSetPrimary: "design/canvas/stage/component-set/toolbar-primary",
  componentSetSecondary: "design/canvas/stage/component-set/toolbar-secondary",
  document: "design/canvas/stage/document",
  documentLightOnly: "design/canvas/stage/document/light-only",
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
  addedWelcome: "design/canvas/outcomes/added/welcome",
  addedToolbar: "design/canvas/outcomes/added/toolbar",
  addedPrimary: "design/canvas/outcomes/added/primary",
  addedSecondary: "design/canvas/outcomes/added/secondary",
} as const;

/**
 * The artboards of the Canvas viewer family. Canvas links stay inside the
 * family: a control opens the Canvas artboard that shows its outcome, and a
 * control without one is a picture of itself.
 */
export const CANVAS_PAGES = {
  ...STAGE_PAGES,
  ...OUTCOME_PAGES,
  ...LOADING_PAGES,
  ...SEARCH_PAGES,
  ...EXPLORER_PAGES,
  ...PROPS_PAGES,
  ...EVIDENCE_PAGES,
  ...FLOW_PAGES,
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
