import { CanvasFrame } from "@mokly/ui/canvas-frame";
import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";

import { frameSizes } from "./published-frames";
import type { ScreenFrame } from "./published-frames";
import { SampleScreen } from "./sample-screen";

/**
 * One frame of the current screen on the canvas: the package's bare frame at
 * its viewport's nominal size, with its label and size tag, holding the
 * sample screen in the frame's own scheme, whatever the document's scheme
 * is, as a frame of the viewer shows its own view.
 */
export function PublishedFrame({ frame }: { frame: ScreenFrame }) {
  const { width, height } = frameSizes[frame.viewport];
  return (
    <CanvasFrame
      height={height}
      kind={frame.viewport}
      label={frame.label}
      scheme={frame.scheme}
      width={width}
    >
      <SampleScreen viewport={frame.viewport} scheme={frame.scheme} />
    </CanvasFrame>
  );
}

/** The frames of the section, each in its cell at its nominal size. */
export function sectionFrames(
  frames: readonly ScreenFrame[],
): CanvasSectionFrame[] {
  return frames.map((frame) => ({
    column: frame.column,
    row: frame.row,
    key: frame.key,
    ...frameSizes[frame.viewport],
    node: <PublishedFrame frame={frame} />,
  }));
}
