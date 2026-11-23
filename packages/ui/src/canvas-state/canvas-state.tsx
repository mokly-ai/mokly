/**
 * The canvas while it holds a state in place of a section, such as while the
 * selected entry's preview loads or after it failed: the dot grid of
 * `CanvasStage` without a section, so without the zoom pill, and the state in
 * the middle of the stage, in a card.
 */

import type { ReactNode, Ref } from "react";

import { CanvasStage } from "../canvas-stage/canvas-stage.js";

export function CanvasState({
  canvasRef,
  children,
  routed = false,
}: {
  /** Receives the canvas. */
  canvasRef?: Ref<HTMLDivElement> | undefined;
  /** The state, such as an `EmptyState`. */
  children: ReactNode;
  /** Whether it is the routed entry's stage, which a host finds by `data-mokly-stage`. */
  routed?: boolean;
}) {
  return (
    <div className="mbk-canvas-state mbk-reset">
      <CanvasStage canvasRef={canvasRef} routed={routed} />
      <div className="mbk-canvas-state-place mbk-reset">
        <div className="mbk-canvas-state-card mbk-reset">{children}</div>
      </div>
    </div>
  );
}
