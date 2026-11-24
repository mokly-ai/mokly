/**
 * Side by side on the canvas: each version of the compared frame stands in
 * its own canvas frame, whose label starts with its version's tag, Before or
 * Current. Both frames' viewports share one scroll controller, so their
 * ranges match and, with Scroll together on, scrolling either moves the
 * other. `@mokly/ui/canvas-frame` draws each frame,
 * `@mokly/ui/canvas-comparison` its document, and `@mokly/ui/comparison-pane`
 * the pane of a version without a document.
 */

import { FrameComparison } from "@mokly/ui/canvas-comparison";
import { CanvasFrame } from "@mokly/ui/canvas-frame";
import { ComparisonLayer, ComparisonPane } from "@mokly/ui/comparison-pane";

import { useCanvasFrameInput } from "./canvas_frame_input.js";
import type { ComparisonFrameCell } from "./comparison_cells.js";
import { ComparisonFrame, type PaneDocument } from "./comparison_frame.js";
import type { ComparisonSide } from "./comparison_scroll_owner.js";
import type { ComparisonScrollSync } from "./comparison_scroll_types.js";
import { ComparisonViewport } from "./comparison_viewport.js";
import type { EntryWording } from "./entry_wording.js";

/** The design catalogue's copy for a version without a document. */
const MISSING = {
  after: "This screen has been removed.",
  before: "This screen did not exist before.",
} as const;

/**
 * One version of the compared frame in its own canvas frame, in the layer of
 * its version, as a stack holds each version. A version without a document
 * keeps its explicit message under its Before or Current label, worded for
 * the entry's kind.
 */
export function SideComparisonFrame({
  cell,
  document,
  side,
  sync,
  wording,
}: {
  cell: ComparisonFrameCell;
  document: PaneDocument | undefined;
  side: ComparisonSide;
  sync: ComparisonScrollSync;
  wording: Pick<EntryWording, "label">;
}) {
  const input = useCanvasFrameInput();
  return (
    <CanvasFrame
      focusVisible={input.focusVisible}
      height={cell.size.height}
      kind={cell.kind}
      label={cell.name}
      scheme={cell.scheme}
      side={side}
      width={cell.size.width}
    >
      <FrameComparison mode="side">
        {document ? (
          <ComparisonViewport sync={sync}>
            <ComparisonLayer side={side}>
              <ComparisonFrame
                {...document}
                canvasInput={input.listener}
                onMeasure={cell.onMeasure}
              />
            </ComparisonLayer>
          </ComparisonViewport>
        ) : (
          <ComparisonPane missing={wording.label(MISSING[side])} side={side} />
        )}
      </FrameComparison>
    </CanvasFrame>
  );
}
