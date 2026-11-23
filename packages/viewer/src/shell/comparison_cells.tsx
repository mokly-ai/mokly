/**
 * The section of the canvas while it compares. In Overlay, Difference and
 * Swipe, each compared frame takes its live frame's cell, and the live frame
 * stays mounted out of the section; a frame whose row has no comparison
 * keeps its live frame. In Side by side, the section holds the compared
 * frame's two versions side by side, each in its own frame, and every live
 * frame stays mounted out of the section.
 */

import type { CanvasFrameKind } from "@mokly/ui/canvas-frame";
import { CanvasFrame } from "@mokly/ui/canvas-frame";
import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";
import { ComparisonFailure } from "@mokly/ui/comparison-stage";

import type { CanvasFrameSize } from "./canvas_frame_size.js";
import type { PaneDocument } from "./comparison_frame.js";
import type { ComparisonSide } from "./comparison_scroll_owner.js";
import type { ComparisonScrollSync } from "./comparison_scroll_types.js";
import type { ComparedFrame } from "./comparison_selection.js";
import { SideComparisonFrame } from "./comparison_side.js";
import { StackedComparisonFrame } from "./comparison_stack.js";
import type { EntryWording } from "./entry_wording.js";

/** A canvas frame that compares: how its cell draws it. */
export interface ComparisonFrameCell {
  /** The frame's place in the section, from 0. */
  column: number;
  kind: Exclude<CanvasFrameKind, "document">;
  /** The frame's label as the canvas shows it, such as `welcome · Mobile · Light`. */
  label: string;
  /** The frame's own name, such as `Mobile · Light`. */
  name: string;
  /** Receives each version's measured size, for a component's frame. */
  onMeasure?:
    ((side: ComparisonSide, size: CanvasFrameSize) => void) | undefined;
  row: number;
  scheme: "dark" | "light";
  size: CanvasFrameSize;
}

/** What one compared frame shows once its row's documents are presented. */
export type ComparedFrameState =
  | { status: "ready"; after?: PaneDocument; before?: PaneDocument }
  | { status: "failed"; message: string };

/** What the section of a compare needs. */
export interface ComparisonSectionInput {
  /** The frames that compare, and the cell and the state of each. */
  frames: readonly {
    cell: ComparisonFrameCell;
    frame: ComparedFrame;
    state: ComparedFrameState;
  }[];
  /** The mode that the frames show: Side by side when a version is missing. */
  mode: "difference" | "overlay" | "side" | "swipe";
  /** Receives each position that Swipe's grip moves to. */
  onSplit: (position: number) => void;
  /** Try again on a row whose comparison could not be loaded, by its entry id. */
  retry: (entry: string) => void;
  /** The frame that Side by side compares, by its key. */
  sideKey: string | undefined;
  split: number;
  /** The scroll controller of each compared frame, by the frame's key. */
  sync: (key: string) => ComparisonScrollSync;
  wording: Pick<EntryWording, "label">;
}

/**
 * A compared frame whose row could not be loaded: the failure in its place,
 * whose Try again requests that row again.
 */
function failedCell(
  frame: ComparedFrame,
  cell: ComparisonFrameCell,
  message: string,
  retry: (entry: string) => void,
): CanvasSectionFrame {
  return {
    column: cell.column,
    height: cell.size.height,
    key: `compare:${frame.key}`,
    node: (
      <CanvasFrame
        height={cell.size.height}
        kind={cell.kind}
        label={cell.label}
        place={
          <ComparisonFailure
            details={message}
            onRetry={() => retry(frame.entry)}
          />
        }
        scheme={cell.scheme}
        width={cell.size.width}
      />
    ),
    row: cell.row,
    width: cell.size.width,
  };
}

/** The compared frame's two versions, side by side from the section's start. */
function sideCells(input: ComparisonSectionInput): CanvasSectionFrame[] {
  const compared = input.frames.find(
    ({ frame }) => frame.key === input.sideKey,
  );
  if (!compared || compared.state.status !== "ready") return [];
  const { cell, frame, state } = compared;
  return (["before", "after"] as const).map((side, column) => ({
    column,
    height: cell.size.height,
    key: `compare:${frame.key}:${side}`,
    node: (
      <SideComparisonFrame
        cell={cell}
        document={state[side]}
        side={side}
        sync={input.sync(`side:${frame.key}`)}
        wording={input.wording}
      />
    ),
    row: 0,
    width: cell.size.width,
  }));
}

/**
 * A compared frame's stack in the cell of its live frame, at `place`, which
 * the compact layout moves to the section's start.
 */
function stackedCell(
  input: ComparisonSectionInput,
  compared: ComparisonSectionInput["frames"][number],
  mode: "difference" | "overlay" | "swipe",
  place: Pick<CanvasSectionFrame, "column" | "row"> = compared.cell,
): CanvasSectionFrame {
  const { frame, state } = compared;
  const cell = { ...compared.cell, column: place.column, row: place.row };
  if (state.status === "failed")
    return failedCell(frame, cell, state.message, input.retry);
  const node =
    state.before && state.after ? (
      <StackedComparisonFrame
        after={state.after}
        before={state.before}
        cell={cell}
        mode={mode}
        onSplit={input.onSplit}
        split={input.split}
        sync={input.sync(`stack:${frame.key}`)}
      />
    ) : null;
  return {
    column: cell.column,
    height: cell.size.height,
    key: `compare:${frame.key}`,
    node,
    row: cell.row,
    width: cell.size.width,
  };
}

/**
 * The section's frames while the canvas compares, from its live frames. A
 * live frame stays in the list, out of the section, so its document stays
 * loaded for the return to Current.
 */
export function comparisonSectionFrames(
  input: ComparisonSectionInput,
  live: readonly CanvasSectionFrame[],
): CanvasSectionFrame[] {
  const away = (frame: CanvasSectionFrame) => ({ ...frame, hidden: true });
  const { mode } = input;
  if (mode === "side") return [...live.map(away), ...sideCells(input)];
  const byKey = new Map(input.frames.map((each) => [each.frame.key, each]));
  const placed = live.flatMap((frame) => {
    const compared = byKey.get(frame.key);
    if (!compared || frame.hidden) return [frame];
    byKey.delete(frame.key);
    return [away(frame), stackedCell(input, compared, mode, frame)];
  });
  // A compared frame without a live frame, such as a removed entry's.
  return [
    ...placed,
    ...[...byKey.values()].map((compared) =>
      stackedCell(input, compared, mode),
    ),
  ];
}
