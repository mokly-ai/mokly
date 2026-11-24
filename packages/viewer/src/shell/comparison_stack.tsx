/**
 * Overlay, Difference and Swipe on one canvas frame: one page viewport fills
 * the frame, and the version before and the current version are stacked at
 * full size in it. `@mokly/ui/canvas-frame` draws the frame,
 * `@mokly/ui/canvas-comparison` the frame's document in the mode,
 * `@mokly/ui/comparison-pane` each version's layer, and
 * `@mokly/ui/swipe-divider` Swipe's divider.
 */

import { FrameComparison } from "@mokly/ui/canvas-comparison";
import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { ComparisonLayer } from "@mokly/ui/comparison-pane";
import { SwipeDivider } from "@mokly/ui/swipe-divider";

import { useCanvasFrameInput } from "./canvas_frame_input.js";
import type { ComparisonFrameCell } from "./comparison_cells.js";
import { ComparisonFrame, type PaneDocument } from "./comparison_frame.js";
import type { ComparisonScrollSync } from "./comparison_scroll_types.js";
import { ComparisonViewport } from "./comparison_viewport.js";

/**
 * One frame whose viewport holds the version before and, above it, the
 * current version at half opacity in Overlay, blended in Difference, or to
 * the right of the divider in Swipe. The frame is never blended, and both
 * layers always share one page offset. Swipe's divider stands at `split` on
 * every frame, and a move of its grip reaches `onSplit`.
 */
export function StackedComparisonFrame({
  after,
  before,
  cell,
  mode,
  onSplit,
  split,
  sync,
}: {
  after: PaneDocument;
  before: PaneDocument;
  cell: ComparisonFrameCell;
  mode: "difference" | "overlay" | "swipe";
  onSplit: (position: number) => void;
  split: number;
  sync: ComparisonScrollSync;
}) {
  const input = useCanvasFrameInput();
  return (
    <CanvasFrame
      focusVisible={input.focusVisible}
      height={cell.size.height}
      kind={cell.kind}
      label={cell.label}
      overlay={
        mode === "swipe" ? (
          <SwipeDivider
            label={`Divider, ${cell.name}`}
            onPosition={onSplit}
            position={split}
          />
        ) : undefined
      }
      scheme={cell.scheme}
      width={cell.size.width}
    >
      <FrameComparison mode={mode} split={mode === "swipe" ? split : undefined}>
        <ComparisonViewport sync={sync}>
          <ComparisonLayer side="before">
            <ComparisonFrame
              {...before}
              canvasInput={input.listener}
              onMeasure={cell.onMeasure}
            />
          </ComparisonLayer>
          <ComparisonLayer side="after">
            <ComparisonFrame
              {...after}
              canvasInput={input.listener}
              onMeasure={cell.onMeasure}
            />
          </ComparisonLayer>
        </ComparisonViewport>
      </FrameComparison>
    </CanvasFrame>
  );
}
