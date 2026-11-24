/**
 * The compare on the canvas. `CanvasComparisonStage` holds the canvas with
 * the entry's section, and, while the comparison loads or after it failed, a
 * canvas with that state in its place, without the zoom pill: the section
 * stays mounted out of sight, so its frames keep their documents and the
 * reader returns to them at once. `FrameComparison` is a canvas frame's
 * document in a comparison: the page viewport that its versions share, at
 * the frame's nominal size, with the version before under the current
 * version in Overlay, Difference and Swipe, or one version in Side by side.
 */

import type { CSSProperties, ReactNode, Ref } from "react";

import { CanvasState } from "../canvas-state/canvas-state.js";

/**
 * How a frame shows its versions: Overlay draws the current version at half
 * opacity over the version before, Difference blends it by difference over
 * the opaque version before, Swipe shows it only to the right of the
 * divider, and a frame of Side by side holds one version.
 */
export type FrameCompareMode = "difference" | "overlay" | "side" | "swipe";

export function CanvasComparisonStage({
  active = false,
  busy = false,
  children,
  component = false,
  entryId,
  ref,
  state,
}: {
  /**
   * Whether a compare mode shows. Only then can the host focus the stage,
   * so a press on the canvas in Current leaves the focus where it was.
   */
  active?: boolean;
  /** Whether the comparison or its documents load. */
  busy?: boolean;
  /** The canvas with the entry's section. */
  children?: ReactNode;
  /** Whether the compared entry is a component. */
  component?: boolean;
  /** The compared entry's path, which the comparison carries. */
  entryId: string;
  /**
   * Receives the stage, which a host focuses after Try again, so the focus
   * stays on the compare while the state gives way to the frames.
   */
  ref?: Ref<HTMLDivElement> | undefined;
  /**
   * The state of the comparison, such as `Loading comparison…` or its
   * failure, which the canvas holds in place of the section while it shows.
   */
  state?: ReactNode;
}) {
  const covered = state !== undefined && state !== null;
  return (
    <div
      aria-busy={busy ? true : undefined}
      className="mbk-canvas-compare mbk-reset"
      data-diff-component={component ? "" : undefined}
      data-diff-screen={entryId}
      ref={ref}
      tabIndex={active ? -1 : undefined}
    >
      <div className="mbk-canvas-compare-live mbk-reset" hidden={covered}>
        {children}
      </div>
      {covered ? (
        <CanvasState>
          <div
            aria-live="polite"
            className="mbk-canvas-compare-state mbk-reset"
            data-diff-stage=""
          >
            {state}
          </div>
        </CanvasState>
      ) : null}
    </div>
  );
}

export function FrameComparison({
  children,
  mode,
  split,
}: {
  /**
   * The versions: the shared viewport with the stacked layers, one
   * version's viewport, or the pane of a version without a document.
   */
  children?: ReactNode;
  mode: FrameCompareMode;
  /** Where Swipe splits the frame, in percent of its width from the left. */
  split?: number | undefined;
}) {
  const style =
    split === undefined
      ? undefined
      : ({ "--mbk-frame-split": `${split}%` } as CSSProperties);
  return (
    <div
      className="mbk-frame-compare mbk-reset"
      data-compare-mode={mode}
      style={style}
    >
      {children}
    </div>
  );
}
