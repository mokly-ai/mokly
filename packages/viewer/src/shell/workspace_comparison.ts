/**
 * The compare of a screen's or a component's workspace on its canvas: the
 * frames that compare, the frame that Side by side compares, the outcome
 * line of each compared frame for the Changes tab, and the comparison
 * controller with the setter of the compared frame.
 */

import { useMemo } from "react";

import type { ChangeStatusValue } from "@mokly/ui/change-status";

import type { CanvasFramePlan } from "./canvas_frames.js";
import type { StandaloneComparisonHead } from "./comparison_canvas.js";
import {
  comparedFrameKey,
  type CanvasComparisonController,
  type ComparedFrameChoice,
} from "./comparison_compared_frame.js";
import { comparedFrameOutcome } from "./comparison_outcome.js";
import type { ComparisonFrameDemand } from "./comparison_presentation.js";
import {
  comparedRows,
  comparisonFramePlans,
  removedComparisonPlans,
  type ComparisonFramePlan,
} from "./comparison_rows.js";
import { comparedFrames, type ComparedFrame } from "./comparison_selection.js";
import { framesChoice } from "./frames_filter.js";
import { useShellStore } from "./store_context.js";
import type { ComparisonController } from "./use_comparison.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** What the canvas and the Changes tab read of a workspace's compare. */
export interface WorkspaceComparison {
  /** The props of `ComparisonCanvas`, less its children. */
  canvas: {
    comparison: ComparisonController;
    entryId: string;
    entryKind: WorkspaceData["entry"]["kind"];
    frames: readonly ComparedFrame[];
    plans: ReadonlyMap<string, ComparisonFramePlan>;
    sideKey: string | undefined;
    standalone?: StandaloneComparisonHead;
  };
  /**
   * The shown frames whose rows compare, which the chips of Side by side
   * name; absent for a removed component or variant, whose views all compare.
   */
  compared: readonly ComparisonFrameDemand[] | undefined;
  controller: CanvasComparisonController;
  /** The outcome line of each compared frame, once the comparison is loaded. */
  outcomes: readonly string[];
}

export function useWorkspaceComparison({
  choice,
  compared: comparing,
  comparison,
  data,
  frames,
  head,
  status,
  usingChanged,
  variant,
}: {
  /** The reader's choice of the frame that Side by side compares. */
  choice: ComparedFrameChoice;
  /**
   * The shown frames whose rows compare, as `comparisonFrames` gives them;
   * absent for a removed component or variant, which has no live frames.
   */
  compared: readonly ComparisonFrameDemand[] | undefined;
  comparison: ComparisonController;
  data: WorkspaceData;
  /** The workspace's frames on the canvas, from which the shown ones compare. */
  frames: readonly CanvasFramePlan[];
  head: { path: string; title: string };
  status: ChangeStatusValue | undefined;
  /** The axes keys of the routed views that use a changed component. */
  usingChanged: ReadonlySet<string> | undefined;
  variant: WorkspaceVariant | undefined;
}): WorkspaceComparison {
  const { frames: schemes, selection } = useShellStore().state;
  const shown = useMemo(
    () => framesChoice(schemes, selection.viewport),
    [schemes, selection.viewport],
  );
  const entry = variant?.value ?? data.entry;
  const routed = entry.path;
  // A removed component or variant has no live frames: its compare draws
  // the frames of its own views alone, of the schemes that the Frames
  // filter shows.
  const removed = data.removed || variant?.removed === true;
  const plans = useMemo(
    () =>
      removed
        ? removedComparisonPlans(data.compared, entry, shown)
        : comparisonFramePlans(frames),
    [data.compared, entry, frames, removed, shown],
  );
  const byKey = useMemo(
    () => new Map(plans.map((plan) => [plan.key, plan])),
    [plans],
  );
  const rows = useMemo(
    () => comparedRows(data, routed, usingChanged),
    [data, routed, usingChanged],
  );
  const generations = comparison.generations;
  const compared = useMemo(
    () => (generations ? comparedFrames(plans, generations, rows) : []),
    [generations, plans, rows],
  );
  const sideKey = comparedFrameKey(compared, choice.chosen);
  const component = data.entry.kind === "component";
  return {
    canvas: {
      comparison,
      entryId: routed,
      entryKind: data.entry.kind,
      frames: compared,
      plans: byKey,
      sideKey,
      ...(removed
        ? {
            standalone: {
              kind: "component",
              path: head.path,
              status,
              title: head.title,
            },
          }
        : {}),
    },
    compared: comparing,
    controller: {
      ...comparison,
      comparedFrame: sideKey,
      setComparedFrame: choice.setComparedFrame,
    },
    outcomes: comparison.presentation
      ? compared.map((frame) =>
          comparedFrameOutcome(
            frame,
            byKey.get(frame.key)?.name ?? frame.key,
            component,
          ),
        )
      : [],
  };
}
