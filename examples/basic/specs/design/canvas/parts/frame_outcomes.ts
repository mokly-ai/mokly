import type { ArtboardViewport } from "../../parts/artboards.js";
import { SCREEN_STYLE_COPY } from "../../parts/stylesheet_evidence.js";

import type { CanvasFrameSpec } from "./frames.js";

/**
 * The label of a compared frame's view in its outcome line, as the CSS
 * evidence presentation contract words it: the label of the view's state, in
 * a screen's words or in a variant's, or a screen's label of a changed view
 * that only its stylesheets prove, or of an unchanged view that changed
 * components affect.
 */
export const VIEW_OUTCOMES = {
  screenChanged: "Screen changed",
  screenStyles: SCREEN_STYLE_COPY.stylesChanged,
  screenComponents: SCREEN_STYLE_COPY.componentsChanged,
  variantChanged: "Variant changed",
  variantRemoved: "Variant removed",
} as const;

/** One label of `VIEW_OUTCOMES`. */
type ViewOutcome = (typeof VIEW_OUTCOMES)[keyof typeof VIEW_OUTCOMES];

/**
 * The outcome line of each frame that a loaded comparison compares, which
 * the comparison details list: the frame's name, a screen frame's viewport
 * or a variant set frame's variant, then its scheme, then the label of its
 * view, such as `Desktop · Light · Screen changed`. A Light view that stands
 * in for the frame's Dark view adds `Light only`. The wide canvas compares
 * every frame of its stage, in the stage's order. The compact form compares
 * the one frame that it picks, or every frame while it picks none.
 */
export function frameOutcomes(
  frames: readonly Pick<CanvasFrameSpec, "id" | "label" | "lightOnly">[],
  outcome: ViewOutcome,
  {
    picked,
    viewport,
  }: { picked?: string | undefined; viewport: ArtboardViewport },
): string[] {
  const compared =
    viewport === "mobile" && picked !== undefined
      ? frames.filter((frame) => frame.id === picked)
      : frames;
  if (compared.length === 0)
    throw new Error("A loaded comparison compares a frame of its stage.");
  return compared.map(
    ({ label, lightOnly }) =>
      `${label} · ${outcome}${lightOnly ? " · Light only" : ""}`,
  );
}
