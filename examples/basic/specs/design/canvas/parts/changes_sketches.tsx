import type { CompareModesProps } from "../../library/panels/compare-modes.js";
import type { ArtboardViewport } from "../../parts/artboards.js";
import type { DepictedView } from "../../parts/depicted_view.js";
import { MiniDetails, MiniWelcome } from "../../parts/mini_screens.js";
import { miniView } from "../../parts/mini_views.js";

import {
  compareFrames,
  screenFrames,
  sideBySideFrames,
  type CanvasFrameSpec,
  type FrameVersion,
} from "./frames.js";
import { welcomeFrames } from "./sketches.js";

/** A compare mode of the Changes tab. */
export type CompareMode = CompareModesProps["mode"];

/** The frame that Side by side compares. */
export type CompareFrame = NonNullable<CompareModesProps["frame"]>;

/**
 * Welcome's two versions, as today's Changes designs depict them: the
 * version before, and the current version with its new introduction and the
 * reworded heading. Its link stays inert, because Canvas links stay inside
 * the Canvas family.
 */
function welcomeVersion(viewport: ArtboardViewport, version: FrameVersion) {
  return (
    <MiniWelcome
      compact={viewport === "mobile"}
      inert
      revised={version === "after"}
    />
  );
}

/**
 * Welcome's frames in each compare mode. Current shows the current version
 * on the four frames, as Inspect does; Overlay, Difference, and Swipe apply
 * to every frame; Side by side shows each frame's two versions as a pair.
 */
export function welcomeChangesFrames(mode: CompareMode): CanvasFrameSpec[] {
  switch (mode) {
    case "current":
      return welcomeFrames();
    case "side-by-side":
      return sideBySideFrames((viewport, _scheme, version) =>
        welcomeVersion(viewport, version),
      );
    default:
      return compareFrames(
        (viewport, _scheme, version) => welcomeVersion(viewport, version),
        mode,
      );
  }
}

/** A comparison, which the shell does not highlight. */
export const COMPARISON_VIEW: DepictedView = { highlight: "comparison" };

/**
 * Details' four frames: the example's Details in each viewport and scheme,
 * whose link stays inert.
 */
export function detailsFrames() {
  return screenFrames((viewport) => (
    <MiniDetails compact={viewport === "mobile"} inert />
  ));
}

/** Details' depicted view, whose instances the highlight marks. */
export const DETAILS_VIEW = miniView("details");
