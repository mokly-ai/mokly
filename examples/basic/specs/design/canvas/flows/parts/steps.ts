import type { DepictedView } from "../../../parts/depicted_view.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { DETAILS_VIEW, detailsFrames } from "../../parts/changes_sketches.js";
import {
  CANVAS_PAGES,
  type CanvasDestination,
} from "../../parts/destinations.js";
import type { CanvasFrameSpec, FrameScheme } from "../../parts/frames.js";
import { WELCOME_VIEW, welcomeFrames } from "../../parts/sketches.js";

/**
 * The one viewport and the one scheme that a use case's Frames filter
 * chooses, so each step shows one frame.
 */
export interface StepFrames {
  viewport: ArtboardViewport;
  scheme: FrameScheme;
}

/** One step of a use case, as its step frame shows it. */
export interface UseCaseStep {
  /**
   * The step's semantic name, which prefixes the instances of its frames, so
   * two steps that show one screen stay apart, and a reorder keeps each
   * step's identity.
   */
  name: string;
  /** The step's number, from one, in step order. */
  number: number;
  title: string;
  description: string;
  /** The Canvas artboard of the step's screen, which the step's link opens. */
  screen: CanvasDestination;
  /**
   * The Changes artboard of the step's screen, which the use case's
   * comparison details link: none while the branch leaves the screen
   * unmodified.
   */
  changes?: CanvasDestination | undefined;
  /** The step screen's frames, one for each viewport and scheme. */
  frames: () => CanvasFrameSpec[];
  /** The step screen's depicted view, whose instances the highlight marks. */
  view: DepictedView;
}

/**
 * The steps of the Example tour on the canonical branch: Welcome, which the
 * branch changed, at its current version, then Details, which the branch
 * added, so the branch changed the screen of each step. Both screens render
 * in Light and in Dark, so no step falls back to its Light view. Their links
 * inside the frames stay inert, because a step's own link opens its screen.
 */
export const TOUR_STEPS: readonly UseCaseStep[] = [
  {
    name: "arrival",
    number: 1,
    title: "Welcome",
    description: "The tour starts on the landing screen.",
    screen: CANVAS_PAGES.overview,
    changes: CANVAS_PAGES.changesCurrent,
    frames: welcomeFrames,
    view: WELCOME_VIEW,
  },
  {
    name: "detail",
    number: 2,
    title: "Details",
    description: "The tour ends on the details screen.",
    screen: CANVAS_PAGES.added,
    changes: CANVAS_PAGES.addedChanges,
    frames: detailsFrames,
    view: DETAILS_VIEW,
  },
];

/**
 * The zoom in percent that fits the tour's section: its two Desktop frames,
 * or its two Mobile frames, in one row with each frame's label and
 * description. Each is the largest zoom that keeps the section at least 10px
 * inside the stage, as Welcome's fitted overview does.
 */
export const TOUR_FITS = {
  desktop: 29,
  mobile: 78,
} as const satisfies Record<ArtboardViewport, number>;
