/**
 * The outcome line of each compared frame, which the comparison band lists:
 * the frame's name, then the label of its view's state, worded for the
 * entry's kind under the
 * [CSS evidence presentation](../../../../docs/protocol/mokly-css-evidence-presentation.md).
 */

import type { ComparedFrame } from "./comparison_selection.js";
import { entryWording } from "./entry_wording.js";

/** The label of each view state, in a screen's words. */
const STATE_LABELS = {
  added: "New screen",
  changed: "Screen changed",
  "ignored-only": "Only excluded content changed",
  removed: "Screen removed",
  unchanged: "No changes to this screen",
} as const;

/**
 * A compared frame's outcome, such as `Desktop · Light · Screen changed`: the
 * frame's name, then "Styles this screen uses changed" for a view that only
 * its stylesheets prove changed, "Components this screen uses changed" for
 * an unchanged view that changed components affect, and else the label of
 * its state. A component says "variant" for "screen". A Light view that
 * stands in for the frame's Dark view adds `Light only`.
 */
export function comparedFrameOutcome(
  frame: Pick<
    ComparedFrame,
    "componentsOnly" | "lightOnly" | "styleOnly" | "view"
  >,
  name: string,
  component: boolean,
): string {
  const wording = entryWording(component ? "component" : "screen");
  const label = frame.styleOnly
    ? wording.stylesChanged
    : frame.componentsOnly
      ? wording.componentsChanged
      : wording.label(STATE_LABELS[frame.view.state]);
  return `${name} · ${label}${frame.lightOnly ? " · Light only" : ""}`;
}
