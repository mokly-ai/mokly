import type { ReactNode } from "react";

import {
  ComparisonLayer,
  ComparisonSurface,
  ComparisonViewport,
} from "../../../../../../packages/ui/src/comparison-pane/comparison-pane.js";
import { ComparisonPanes } from "../../../../../../packages/ui/src/comparison-stage/comparison-stage.js";

/** How a frame shows its two versions in a comparison. */
export type FrameCompare = "difference" | "overlay" | "swipe";

/** Where Swipe splits a frame, in percent from its left edge. */
export const SWIPE_SPLIT = 50;

/**
 * A frame's document in a comparison: the shipped viewport that both
 * versions share, the version before under the current version, each on the
 * shipped opaque surface in the frame's scheme. Overlay and Difference are
 * the shipped stacked modes: the current version at half opacity, or blended
 * by difference over the version before. Swipe shows the version before to
 * the left of its divider and the current version to the right.
 */
export function FrameComparison({
  before,
  compare,
  current,
}: {
  before: ReactNode;
  compare: FrameCompare;
  current: ReactNode;
}) {
  const layers = (
    <ComparisonViewport>
      <ComparisonLayer side="before">
        <ComparisonSurface>{before}</ComparisonSurface>
      </ComparisonLayer>
      <ComparisonLayer side="after">
        <ComparisonSurface>{current}</ComparisonSurface>
      </ComparisonLayer>
    </ComparisonViewport>
  );
  return compare === "swipe" ? (
    <div className="cv-frame-swipe">{layers}</div>
  ) : (
    <ComparisonPanes mode={compare}>{layers}</ComparisonPanes>
  );
}
