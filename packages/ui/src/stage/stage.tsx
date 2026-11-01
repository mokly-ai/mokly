/**
 * The stage: the dotted surface that holds a preview. A stage of frames
 * shows the frame of each viewport side by side and keeps its scroll
 * position across navigation; a bare stage holds a state, such as loading.
 */

import type { ReactNode } from "react";

/** The viewports that a stage shows. */
export type StageViewport = "both" | "desktop" | "mobile";

export function Stage({
  children,
  kind,
  routed = false,
  viewport,
}: {
  children?: ReactNode;
  /**
   * The frames that the stage holds: `live` screen frames, which it hides by
   * the shown viewport, or a `component`'s canvases. A stage without frames
   * holds a state.
   */
  kind?: "component" | "live" | undefined;
  /**
   * Whether it is the routed entry's stage, which a host and its tests find
   * by `data-mokly-stage`.
   */
  routed?: boolean;
  /** The shown viewport, which a stage of frames records. */
  viewport?: StageViewport | undefined;
}) {
  return (
    <div
      className={
        kind === undefined
          ? "mbk-stage mbk-reset"
          : `mbk-stage ${kind === "component" ? "mbk-component-stage" : "mbk-live"} mbk-reset`
      }
      data-mokly-scroll={kind === undefined ? undefined : "stage"}
      data-mokly-stage={routed ? "" : undefined}
      data-viewport={viewport}
    >
      {children}
    </div>
  );
}
