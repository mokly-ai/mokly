import { ExampleDocument } from "../../../../document.js";
import type { ArtboardViewport } from "../../../parts/artboards.js";
import { MiniWelcome } from "../../../parts/mini_screens.js";
import { miniView } from "../../../parts/mini_views.js";
import {
  readingFrame,
  screenFrames,
  sideBySideFrames,
  type CanvasFrameSpec,
  type FrameVersion,
} from "../../parts/frames.js";

/**
 * Welcome on a branch whose changed stylesheet reaches it: the version
 * before, and the current version, whose navigation and link the changed
 * styles restyle. Its link stays inert, because Canvas links stay inside the
 * Canvas family.
 */
function styledWelcome(viewport: ArtboardViewport, version: FrameVersion) {
  return (
    <MiniWelcome
      compact={viewport === "mobile"}
      inert
      restyled={version === "after"}
    />
  );
}

/**
 * The restyled Welcome in Side by side: each frame's two versions as a pair,
 * at the same frame size, of which the stage shows the compared frame's.
 */
export function styledWelcomePairs(): CanvasFrameSpec[] {
  return sideBySideFrames((viewport, _scheme, version) =>
    styledWelcome(viewport, version),
  );
}

/** The restyled Welcome's four frames in Current: its current version. */
export function styledWelcomeFrames(): CanvasFrameSpec[] {
  return screenFrames((viewport) => styledWelcome(viewport, "after"));
}

/**
 * Welcome's four frames where nothing that the comparison reads changed:
 * the version of the branch point, apart from the content of its navigation,
 * which the comparison leaves out.
 */
export function plainWelcomeFrames(): CanvasFrameSpec[] {
  return screenFrames((viewport) => (
    <MiniWelcome compact={viewport === "mobile"} inert />
  ));
}

/**
 * The depicted view of Welcome without its revision, whose instances the
 * highlight marks: the restyled version keeps the same instances.
 */
export const PLAIN_WELCOME_VIEW = miniView("welcome");

/**
 * The Getting started page as one reading frame: its own document, which
 * keeps its own light page in either appearance, so the frame is light. Its
 * link stays inert, because Canvas links stay inside the Canvas family.
 */
export function handbookFrames(): CanvasFrameSpec[] {
  return [
    readingFrame(
      "catalogue.tsx",
      <ExampleDocument readOnly />,
      { width: 760, height: 420 },
      "light",
    ),
  ];
}
