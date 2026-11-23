/**
 * What the canvas shows while a compare mode shows, under the
 * [comparison panes lifecycle](../../../../docs/protocol/mokly-comparison-panes.md#lifecycle):
 * `Loading comparison…` until every shown frame's documents are presented,
 * the failure with Try again when the request or every shown row failed, the
 * line of an entry without a comparison, or the compared frames, each with
 * its versions or its own row's failure.
 */

import type { ComparisonDocumentsState } from "./comparison_documents.js";
import type { ComparisonMode } from "./comparison_presentation.js";
import type { ComparedFrame } from "./comparison_selection.js";
import type { ComparisonRowsState } from "./use_comparison_documents.js";

/** The modes that draw on the frames. */
export type CanvasCompareMode = Exclude<ComparisonMode, "current">;

/** The state of the canvas during a compare. */
export type CanvasCompareState =
  | { status: "loading" }
  | { message: string; status: "failed" }
  | { status: "unavailable" }
  | { mode: CanvasCompareMode; status: "ready" };

/**
 * The mode that the frames show: the presented mode, or Side by side while a
 * compared frame misses a version, because one version cannot stack.
 */
export function shownCompareMode(
  presented: CanvasCompareMode,
  frames: readonly Pick<ComparedFrame, "documents">[],
): CanvasCompareMode {
  return frames.some(({ documents }) => !documents.before || !documents.after)
    ? "side"
    : presented;
}

/** The frames whose documents a mode shows: Side by side shows one frame's. */
export function shownComparedFrames<Frame extends Pick<ComparedFrame, "key">>(
  frames: readonly Frame[],
  mode: CanvasCompareMode,
  sideKey: string | undefined,
): readonly Frame[] {
  return mode === "side"
    ? frames.filter((frame) => frame.key === sideKey)
    : frames;
}

/**
 * The canvas's state from the request's failure, the shown mode, the frames
 * that it draws and the state of each of their rows' documents.
 */
export function canvasCompareState({
  failure,
  frames,
  mode,
  rows,
}: {
  failure: string | undefined;
  /** The frames that the shown mode draws, from `shownComparedFrames`. */
  frames: readonly Pick<ComparedFrame, "entry">[];
  /** The mode that the frames show, once the loaded comparison presents one. */
  mode: CanvasCompareMode | undefined;
  rows: ComparisonRowsState;
}): CanvasCompareState {
  if (failure !== undefined) return { message: failure, status: "failed" };
  if (mode === undefined) return { status: "loading" };
  if (!frames.length) return { status: "unavailable" };
  const states = frames.map(
    ({ entry }): ComparisonDocumentsState =>
      rows.get(entry) ?? { status: "loading" },
  );
  if (states.some(({ status }) => status === "loading" || status === "idle"))
    return { status: "loading" };
  const failed = states.filter(
    (state): state is Extract<ComparisonDocumentsState, { status: "failed" }> =>
      state.status === "failed",
  );
  if (failed.length === states.length)
    return { message: failed[0]!.message, status: "failed" };
  return { mode, status: "ready" };
}
